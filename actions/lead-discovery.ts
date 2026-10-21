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
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to load lead discovery summary",
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
          website: (mockLead as any).website || null,
          source: mockLead.source,
          sourceDetail: mockLead.sourceDetail,
          status: mockLead.status,
          rating: mockLead.rating,
          description: mockLead.description,
          customerLinkedin: (mockLead as any).customerLinkedin || null,
          companyLinkedin: (mockLead as any).companyLinkedin || null,
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

    let scrapedWebsiteText: string | null = null;
    let researchSourceInfo: {
      url?: string;
      title?: string;
      accessedAt?: string;
      error?: string;
    } | null = null;

    const targetUrl = sources.primarySourceUrl;
    if (targetUrl) {
      try {
        const { extractTextFromUrl } = await import("@/lib/ai/company-matrix-extractor");
        const textRes = await extractTextFromUrl(targetUrl);
        researchSourceInfo = {
          url: textRes.url || targetUrl,
          title: textRes.title,
          accessedAt: textRes.accessedAt,
          error: textRes.error,
        };
        if (textRes.success && textRes.text) {
          scrapedWebsiteText = textRes.text;
        }
      } catch (err: any) {
        researchSourceInfo = {
          url: targetUrl,
          error: err?.message || "Failed to reach website/profile URL",
          accessedAt: new Date().toISOString(),
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
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to generate AI discovery summary",
    };
  }
}
