"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import { prisma } from "@/lib/db/prisma";
import { mockLeadsStore, mockLeadDiscoveriesStore } from "@/lib/db/mock-store";
import { getAiConfigAction } from "@/actions/ai-email";
import { getCompanyMatrixAction } from "@/actions/company-matrix";
import {
  leadDiscoverySchema,
  extractLeadResearchSources,
  type LeadDiscoveryData,
  type LeadDiscoveryInputContext,
} from "@/lib/validations/lead-discovery";
import { generateLeadDiscovery } from "@/lib/ai/lead-discovery-engine";

/**
 * Retrieve cached AI discovery intelligence for a lead
 */
export async function getLeadDiscoveryAction(leadId: string): Promise<{
  success: boolean;
  data: LeadDiscoveryData | null;
  error?: string;
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    if (!leadId) {
      return { success: false, error: "Lead ID is required", data: null };
    }

    // 1. Check PostgreSQL system_settings
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          organizationId_key: {
            organizationId,
            key: `lead_discovery_${leadId}`,
          },
        },
      });

      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        const valid = leadDiscoverySchema.safeParse(parsed);
        if (valid.success) {
          mockLeadDiscoveriesStore[leadId] = valid.data;
          return { success: true, data: valid.data };
        }
      }
    } catch {
      // Prisma error fallback
    }

    // 2. Check in-memory store
    if (mockLeadDiscoveriesStore[leadId]) {
      return { success: true, data: mockLeadDiscoveriesStore[leadId] };
    }

    return { success: true, data: null };
  } catch (err: unknown) {
    const errorMsg = (err as Error)?.message || "Failed to load lead discovery summary";
    return {
      success: false,
      error: errorMsg,
      data: null,
    };
  }
}

/**
 * Generate or refresh AI discovery & strategic sales pitch for a lead
 */
export async function generateLeadDiscoveryAction(
  leadId: string,
  options?: { forceRefresh?: boolean }
): Promise<{
  success: boolean;
  data?: LeadDiscoveryData;
  error?: string;
  urlStatus?: {
    url: string;
    isWorking: boolean;
    error?: string;
  };
}> {
  try {
    const session = await requireAuth();
    const { organizationId } = await resolveTenantContext(session);

    if (!leadId) {
      return { success: false, error: "Lead ID is required" };
    }

    // 1. If not forcing refresh, check if we already have it cached
    if (!options?.forceRefresh) {
      const cached = await getLeadDiscoveryAction(leadId);
      if (cached.success && cached.data) {
        return { success: true, data: cached.data };
      }
    }

    // 2. Retrieve lead details
    let leadInput: LeadDiscoveryInputContext | null = null;
    let pastNotes = "";

    try {
      const dbLead = await prisma.lead.findFirst({
        where: { id: leadId, organizationId, deletedAt: null },
        include: {
          activities: {
            where: { outcome: { not: "SCHEDULED" } },
            orderBy: { activityAt: "desc" },
            take: 5,
          },
          notes: {
            orderBy: { createdAt: "desc" },
            take: 3,
          },
        },
      });

      if (dbLead) {
        pastNotes = [
          ...dbLead.activities.map((a) => `${a.type}: ${a.subject}`),
          ...dbLead.notes.map((n) => `Note: ${n.content}`),
        ].join("; ");

        leadInput = {
          id: dbLead.id,
          fullName: `${dbLead.firstName} ${dbLead.lastName || ""}`.trim(),
          firstName: dbLead.firstName,
          lastName: dbLead.lastName,
          companyName: dbLead.companyName,
          jobTitle: dbLead.jobTitle,
          email: dbLead.email,
          phone: dbLead.phone,
          website: dbLead.website || null,
          source: dbLead.source,
          sourceDetail: dbLead.sourceDetail,
          status: dbLead.status,
          rating: dbLead.rating,
          description: dbLead.description,
          customerLinkedin: dbLead.customerLinkedin,
          companyLinkedin: dbLead.companyLinkedin,
          estimatedValue: dbLead.estimatedValue ? Number(dbLead.estimatedValue) : 0,
          pastActivitiesSummary: pastNotes || null,
        };
      }
    } catch {
      // Database query failed, fall through to mock store
    }

    // Mock store fallback if not in DB
    if (!leadInput) {
      const mockLead = mockLeadsStore.find((l) => l.id === leadId);
      if (mockLead) {
        leadInput = {
          id: mockLead.id,
          fullName: mockLead.fullName,
          firstName: mockLead.firstName,
          lastName: mockLead.lastName,
          companyName: mockLead.companyName,
          jobTitle: mockLead.jobTitle,
          email: mockLead.email,
          phone: mockLead.phone,
          website: mockLead.website || null,
          source: mockLead.source,
          sourceDetail: mockLead.sourceDetail,
          status: mockLead.status,
          rating: mockLead.rating,
          description: mockLead.description,
          customerLinkedin: mockLead.customerLinkedin || null,
          companyLinkedin: mockLead.companyLinkedin || null,
          estimatedValue: mockLead.estimatedValue,
          pastActivitiesSummary: null,
        };
      }
    }

    if (!leadInput) {
      return { success: false, error: "Lead record could not be found." };
    }

    // 2a. Validate and extract research sources (Website URL, Personal LinkedIn, Company LinkedIn)
    const sources = extractLeadResearchSources(leadInput);

    if (!sources.hasAnySource) {
      return {
        success: false,
        error:
          "AI Client Discovery requires at least one research source (Company Website, Personal LinkedIn, or Company LinkedIn URL) to scrape prospect data and evaluate fit. Please add at least one URL to this lead record before generating discovery.",
      };
    }

    leadInput.website = sources.website;
    leadInput.customerLinkedin = sources.customerLinkedin;
    leadInput.companyLinkedin = sources.companyLinkedin;

    // 2b. Attempt to scrape candidate research URLs in priority order (Website -> Company LinkedIn -> Personal LinkedIn)
    const candidateUrls = [
      sources.website,
      sources.companyLinkedin,
      sources.customerLinkedin,
    ].filter(Boolean) as string[];

    let scrapedWebsiteText: string | null = null;
    let researchSourceInfo: {
      url?: string;
      title?: string;
      accessedAt?: string;
      error?: string;
      isReachable?: boolean;
    } | null = null;
    let lastScrapeError: string | null = null;
    let attemptedUrl: string = candidateUrls[0] || "";

    const { extractTextFromUrl } = await import("@/lib/ai/company-matrix-extractor");

    for (const targetUrl of candidateUrls) {
      attemptedUrl = targetUrl;
      try {
        const textRes = await extractTextFromUrl(targetUrl);
        researchSourceInfo = {
          url: textRes.url || targetUrl,
          title: textRes.title,
          accessedAt: textRes.accessedAt,
          error: textRes.error,
          isReachable: textRes.success,
        };

        if (textRes.success && textRes.text && textRes.text.length >= 50) {
          scrapedWebsiteText = textRes.text;
          lastScrapeError = null;
          break; // Successfully scraped valid content
        } else {
          lastScrapeError =
            textRes.error ||
            "Unable to extract readable content from the provided website URL.";
        }
      } catch (err: unknown) {
        lastScrapeError = (err as Error)?.message || "Failed to reach website/profile URL";
        researchSourceInfo = {
          url: targetUrl,
          error: lastScrapeError,
          accessedAt: new Date().toISOString(),
          isReachable: false,
        };
      }
    }

    // 2c. Guard: If scraping failed on the URL(s) AND there are no substantive business description notes,
    // we MUST NOT generate generic discovery! Halt and tell the sales rep the URL is not working.
    if (!scrapedWebsiteText) {
      const hasSubstantiveDescription =
        Boolean(leadInput.description && leadInput.description.trim().length >= 80);

      if (!hasSubstantiveDescription) {
        return {
          success: false,
          error: `The provided research URL (${attemptedUrl}) is not working or is unreachable (${lastScrapeError || "Connection failed"}). Without active website or social profile content to scrape, AI Discovery cannot determine whether this prospect is a good fit. Please check the URL or provide a working website or active LinkedIn link.`,
          urlStatus: {
            url: attemptedUrl,
            isWorking: false,
            error: lastScrapeError || "Connection failed",
          },
        };
      }
    }

    // 3. Load tenant AI config (to check OpenAI API key) and company matrix
    const [aiConfigRes, matrixRes] = await Promise.all([
      getAiConfigAction({ internalServerCall: true }),
      getCompanyMatrixAction(),
    ]);

    const aiConfig = aiConfigRes.success ? aiConfigRes.data : null;
    const companyMatrix = matrixRes.success ? matrixRes.data : null;

    // 4. Generate Discovery Brief
    const discovery = await generateLeadDiscovery(leadInput, {
      aiConfig,
      companyMatrix,
      scrapedWebsiteText,
      researchSourceInfo,
      forceRefresh: options?.forceRefresh,
    });

    // 5. Persist to PostgreSQL system_settings
    try {
      await prisma.systemSetting.upsert({
        where: {
          organizationId_key: {
            organizationId,
            key: `lead_discovery_${leadId}`,
          },
        },
        create: {
          organizationId,
          key: `lead_discovery_${leadId}`,
          value: JSON.stringify(discovery),
        },
        update: {
          value: JSON.stringify(discovery),
        },
      });
    } catch {
      // Prisma fallback
    }

    // 6. Cache in-memory
    mockLeadDiscoveriesStore[leadId] = discovery;

    // 7. Revalidate lead detail page
    try {
      revalidatePath(`/leads/${leadId}`);
    } catch {
      // Ignore
    }

    return { success: true, data: discovery };
  } catch (err: unknown) {
    return {
      success: false,
      error: (err as Error)?.message || "Failed to generate AI discovery summary",
    };
  }
}

/**
 * Pre-flight URL reachability & scrape verification action for sales reps
 */
export async function checkLeadResearchUrlAction(rawUrl: string): Promise<{
  success: boolean;
  isWorking: boolean;
  url: string;
  title?: string;
  error?: string;
  textPreview?: string;
}> {
  try {
    await requireAuth();
    if (!rawUrl || !rawUrl.trim()) {
      return {
        success: false,
        isWorking: false,
        url: "",
        error: "No URL provided",
      };
    }
    const { extractTextFromUrl } = await import("@/lib/ai/company-matrix-extractor");
    const res = await extractTextFromUrl(rawUrl);
    return {
      success: true,
      isWorking: res.success,
      url: res.url || rawUrl,
      title: res.title,
      error: res.error,
      textPreview: res.text ? res.text.slice(0, 180) : undefined,
    };
  } catch (err: unknown) {
    return {
      success: false,
      isWorking: false,
      url: rawUrl,
      error: (err as Error)?.message || "Failed to test URL connection",
    };
  }
}
