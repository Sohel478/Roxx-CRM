import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockLeadsStore,
  mockLeadDiscoveriesStore,
  mockAiConfigsStore,
} from "@/lib/db/mock-store";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_rep_1",
  organizationId: "org_discovery_test",
  organizationName: "Discovery Test Org",
  email: "rep@roxx-crm.com",
  name: "Sarah Sales",
  role: "SALES_REP",
  permissions: ["lead:read", "lead:update"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

import {
  getLeadDiscoveryAction,
  generateLeadDiscoveryAction,
} from "@/actions/lead-discovery";
import {
  generateLeadDiscovery,
  synthesizeHeuristicDiscovery,
} from "@/lib/ai/lead-discovery-engine";

describe("AI Lead Discovery & Strategic Sales Pitch Engine", () => {
  beforeEach(() => {
    mockLeadsStore.length = 0;
    Object.keys(mockLeadDiscoveriesStore).forEach((k) => delete mockLeadDiscoveriesStore[k]);
    Object.keys(mockAiConfigsStore).forEach((k) => delete mockAiConfigsStore[k]);

    // Seed Hospitality Test Lead matching user's exact example
    mockLeadsStore.push({
      id: "lead_hospitality_1",
      organizationId: "org_discovery_test",
      leadNumber: "LEAD-1362",
      firstName: "Johnny",
      lastName: "Huynh",
      fullName: "Johnny Huynh",
      email: "johnny@bayviewsuites.com",
      phone: "+1 555-0188",
      companyName: "Bayview Luxury Suites & Hospitality",
      jobTitle: "General Manager",
      source: "Scraped Data",
      sourceDetail: "Hospitality Lead Directory",
      status: "New",
      rating: "Warm",
      estimatedValue: 25000,
      currency: "USD",
      ownerId: "usr_rep_1",
      ownerName: "Sarah Sales",
      createdById: "usr_rep_1",
      createdAt: new Date().toISOString(),
      description:
        "Boutique hotel & hospitality resort looking to overhaul digital guest acquisition. Inquiries note that current website has high bounce rate and OTA commissions are cutting margins.",
    });
  });

  it("synthesizes hospitality client discovery with web design & SEO pitch recommendation", () => {
    const lead = mockLeadsStore[0];
    const discovery = synthesizeHeuristicDiscovery(
      {
        id: lead.id,
        fullName: lead.fullName,
        firstName: lead.firstName,
        lastName: lead.lastName,
        companyName: lead.companyName,
        jobTitle: lead.jobTitle,
        email: lead.email,
        description: lead.description,
        source: lead.source,
      },
      {
        websiteUrl: "https://roxx-crm.com",
        sourceDocuments: [],
        elevatorPitch: "Premier B2B digital design and development agency.",
        serviceOfferings: ["Web Design", "Web Development", "SEO & Search Visibility"],
        coreSkillsets: ["UI/UX", "Responsive Development", "Local SEO"],
        targetIndustries: ["Hospitality", "Healthcare", "E-Commerce"],
        caseStudies: [
          {
            title: "Hospitality Direct Booking Overhaul",
            metric: "+38% direct revenue",
            summary: "Redesigned hotel web presence and booking flow.",
          },
        ],
        outOfScopeExclusions: ["Hardware Installation", "Print Catalogs"],
        lastExtractedAt: new Date().toISOString(),
        lastExtractedSource: "Website",
      }
    );

    // a) Client business is of hospitality
    expect(discovery.clientBusiness.toLowerCase()).toContain("hospitality");
    expect(discovery.businessSummary.toLowerCase()).toContain("hospitality");

    // b) Currently looking for Web design and SEO for sales/bookings
    const needsBlob = discovery.currentNeeds.join(" ").toLowerCase();
    expect(needsBlob).toContain("web design");
    expect(needsBlob).toContain("seo");

    // Recommendation: Pitch client about Web design as we focus on it and share samples
    const recBlob = discovery.recommendations.join(" ").toLowerCase();
    expect(recBlob).toContain("web design");
    expect(recBlob).toContain("sample");

    // Talking points and ready-to-use opening hook
    expect(discovery.talkingPoints.length).toBeGreaterThanOrEqual(2);
    expect(discovery.openingPitchHook).toBeTruthy();
  });

  it("generates and persists discovery via server action", async () => {
    const genRes = await generateLeadDiscoveryAction("lead_hospitality_1", {
      forceRefresh: true,
    });

    expect(genRes.success).toBe(true);
    expect(genRes.data).toBeDefined();
    expect(genRes.data?.clientBusiness.toLowerCase()).toContain("hospitality");
    expect(genRes.data?.targetOffering.toLowerCase()).toContain("web design");

    // Check cached retrieval
    const getRes = await getLeadDiscoveryAction("lead_hospitality_1");
    expect(getRes.success).toBe(true);
    expect(getRes.data).toBeDefined();
    expect(getRes.data?.leadId).toBe("lead_hospitality_1");
  });

  it("integrates with OpenAI API when provider is openai and API key is present", async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                clientBusiness: "Luxury Hospitality & Resort Management",
                businessSummary:
                  "Independent boutique hospitality resort offering premier guest accommodations and dining.",
                currentNeeds: [
                  "The client is currently looking for modern Web design and SEO expertise to increase direct bookings and revenue.",
                  "Needs mobile-optimized booking flow to reduce dependence on OTA platforms.",
                ],
                recommendations: [
                  "Pitch client about Web design as we focus on it and share relevant hospitality portfolio samples.",
                  "Introduce localized SEO strategies to drive high-margin organic reservations.",
                ],
                targetOffering: "Hospitality Web Design & SEO",
                talkingPoints: [
                  "What percentage of your current guests book directly vs through Expedia?",
                  "Are you seeing mobile abandonment on your existing website?",
                ],
                openingPitchHook:
                  "We specialize in modern web design for hospitality groups that has driven a 35% lift in direct bookings.",
              }),
            },
          },
        ],
      }),
    } as any);

    try {
      const lead = mockLeadsStore[0];
      const result = await generateLeadDiscovery(
        {
          id: lead.id,
          fullName: lead.fullName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          jobTitle: lead.jobTitle,
          description: lead.description,
        },
        {
          aiConfig: {
            aiProvider: "openai",
            apiKey: "sk-test-openai-key-12345",
          },
        }
      );

      expect(result.provider).toBe("openai");
      expect(result.modelUsed).toBe("gpt-4o-mini");
      expect(result.clientBusiness).toBe("Luxury Hospitality & Resort Management");
      expect(result.currentNeeds.some((n) => n.includes("Web design"))).toBe(true);
      expect(result.recommendations.some((r) => r.includes("Web design"))).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("falls back gracefully to built-in heuristic engine if OpenAI fetch encounters an error", async () => {
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockRejectedValue(new Error("Network timeout connecting to OpenAI"));

    try {
      const lead = mockLeadsStore[0];
      const result = await generateLeadDiscovery(
        {
          id: lead.id,
          fullName: lead.fullName,
          firstName: lead.firstName,
          lastName: lead.lastName,
          companyName: lead.companyName,
          jobTitle: lead.jobTitle,
          description: lead.description,
        },
        {
          aiConfig: {
            aiProvider: "openai",
            apiKey: "sk-test-openai-key-12345",
          },
        }
      );

      expect(result.provider).toBe("builtin");
      expect(result.modelUsed).toBe("neural-heuristic");
      expect(result.clientBusiness.toLowerCase()).toContain("hospitality");
      expect(result.currentNeeds.length).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
