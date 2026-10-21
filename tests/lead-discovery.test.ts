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
  checkLeadResearchUrlAction,
} from "@/actions/lead-discovery";
import {
  generateLeadDiscovery,
  synthesizeHeuristicDiscovery,
  calculateQualificationRubric,
} from "@/lib/ai/lead-discovery-engine";
import { isSafePublicUrl } from "@/lib/ai/company-matrix-extractor";

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
      website: "https://bayviewsuites.com",
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

    // Company Matrix Fit & Time-Worthiness Verdict
    expect(discovery.fitAssessment).toBeDefined();
    expect(discovery.fitAssessment?.fitLevel).toBe("EXCELLENT");
    expect(discovery.fitAssessment?.isWorthTime).toBe(true);
    expect(discovery.fitAssessment?.fitScore).toBeGreaterThanOrEqual(85);
    expect(discovery.fitAssessment?.timeInvestmentGuidance.toLowerCase()).toContain("worth spending time");
    expect(discovery.fitAssessment?.fitReasons.length).toBeGreaterThan(0);
    expect(discovery.fitAssessment?.exclusionAlert).toBeNull();
  });

  it("evaluates lead as POOR fit and NOT worth heavy time when out-of-scope exclusion is triggered", () => {
    const lead = {
      id: "lead_out_of_scope_1",
      fullName: "Bob Mechanic",
      firstName: "Bob",
      lastName: "Mechanic",
      companyName: "Acme Industrial Hardware Repair",
      jobTitle: "Owner",
      email: "bob@acme-repair.com",
      description: "Looking for physical server hardware installation and repair in warehouse facility.",
    };

    const discovery = synthesizeHeuristicDiscovery(
      lead,
      {
        websiteUrl: "https://roxx-crm.com",
        sourceDocuments: [],
        elevatorPitch: "Premier B2B digital design and development agency.",
        serviceOfferings: ["Web Design", "Web Development", "SEO & Search Visibility"],
        coreSkillsets: ["UI/UX", "Responsive Development", "Local SEO"],
        targetIndustries: ["Hospitality", "Healthcare", "E-Commerce"],
        caseStudies: [],
        outOfScopeExclusions: ["Hardware Installation", "Print Catalogs"],
      }
    );

    expect(discovery.fitAssessment).toBeDefined();
    expect(discovery.fitAssessment?.fitLevel).toBe("POOR");
    expect(discovery.fitAssessment?.isWorthTime).toBe(false);
    expect(discovery.fitAssessment?.fitScore).toBeLessThanOrEqual(50);
    expect(discovery.fitAssessment?.timeInvestmentGuidance.toLowerCase()).toContain("not worth heavy time");
    expect(discovery.fitAssessment?.exclusionAlert).toContain("Hardware Installation");
    expect(discovery.fitAssessment?.fitReasons.some(r => r.includes("Hardware Installation"))).toBe(true);
  });

  it("generates and persists discovery via server action", async () => {
    const genRes = await generateLeadDiscoveryAction("lead_hospitality_1", {
      forceRefresh: true,
    });

    expect(genRes.success).toBe(true);
    expect(genRes.data).toBeDefined();
    expect(genRes.data?.clientBusiness.toLowerCase()).toContain("hospitality");
    expect(genRes.data?.targetOffering.toLowerCase()).toContain("web design");
    expect(genRes.data?.fitAssessment).toBeDefined();
    expect(genRes.data?.fitAssessment?.isWorthTime).toBe(true);

    // Check cached retrieval
    const getRes = await getLeadDiscoveryAction("lead_hospitality_1");
    expect(getRes.success).toBe(true);
    expect(getRes.data).toBeDefined();
    expect(getRes.data?.leadId).toBe("lead_hospitality_1");
    expect(getRes.data?.fitAssessment).toBeDefined();
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
                fitAssessment: {
                  fitLevel: "EXCELLENT",
                  fitScore: 95,
                  isWorthTime: true,
                  timeInvestmentGuidance: "WORTH SPENDING TIME (High Priority — Dedicate Full Custom Pitch)",
                  fitReasons: [
                    "Direct match with our core Web Design & SEO offering.",
                    "High estimated revenue and booking upside.",
                  ],
                  exclusionAlert: null,
                },
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
      expect(result.fitAssessment?.fitLevel).toBe("EXCELLENT");
      expect(result.fitAssessment?.isWorthTime).toBe(true);
      expect(result.fitAssessment?.fitScore).toBe(95);
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
      expect(result.fitAssessment?.isWorthTime).toBe(true);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("accurately analyzes boutique floral design client (Leaves Floral Design) without generic tech templates", () => {
    const floralLead = {
      id: "lead_floral_leaves",
      fullName: "Sheetal D",
      firstName: "Sheetal",
      lastName: "D",
      companyName: "Leaves Floral Design",
      email: "info@leavesfloraldesign.com",
      phone: "1 414-651-6622",
      website: "https://www.leavesfloraldesign.com/",
      description: "Website: https://www.leavesfloraldesign.com/\nSupport Email: info@leavesfloraldesign.com",
    };

    const discovery = synthesizeHeuristicDiscovery(floralLead);

    // Verifies it identified floral design, NOT generic technology & modern services
    expect(discovery.clientBusiness.toLowerCase()).toContain("floral");
    expect(discovery.clientBusiness.toLowerCase()).not.toContain("technology");

    // Verifies bespoke needs around wedding florals and portfolios
    const needsText = discovery.currentNeeds.join(" ").toLowerCase();
    expect(needsText).toMatch(/floral|wedding|bridal|portfolio/);

    // Verifies tailored talking points for floral studio
    expect(discovery.talkingPoints[0].toLowerCase()).toMatch(/floral|wedding|event/);
    expect(discovery.openingPitchHook.toLowerCase()).toContain("leaves floral design");
    expect(discovery.fitAssessment?.fitLevel).toBe("EXCELLENT");
    expect(discovery.fitAssessment?.isWorthTime).toBe(true);
  });

  it("accurately classifies Rainbow Balloons as B2B Wholesale eCommerce and extracts location & business model without studio misclassification", () => {
    const rainbowLead = {
      id: "lead_rainbow_balloons_1",
      fullName: "Rainbow Balloons Contact",
      firstName: "Rainbow",
      lastName: "Balloons",
      companyName: "Rainbow Balloons, Inc.",
      email: "info@rainbowballoons.com",
      website: "https://rainbowballoons.com/",
      description:
        "Website: https://rainbowballoons.com/\nWholesale distributor of balloons and party supplies, Qualatex latex, foil balloons, decorator training and party supplies.\nHeadquarters: 65 Holton St., Woburn, MA 01801, USA\nOperating for over 40 years as a premier wholesale distributor.",
    };

    const discovery = synthesizeHeuristicDiscovery(rainbowLead);

    // 1. Must identify B2B Wholesale / Event & Party Supply
    expect(discovery.clientBusiness.toLowerCase()).toMatch(/wholesale|event|party/);
    expect(discovery.clientBusiness.toLowerCase()).not.toContain("fitness");
    expect(discovery.clientBusiness.toLowerCase()).not.toContain("wellness");
    expect(discovery.clientBusiness.toLowerCase()).not.toContain("studio");

    // 2. Executive Company Overview Details must be populated
    expect(discovery.companyOverviewDetails).toBeDefined();
    expect(discovery.companyOverviewDetails?.companyName).toBe("Rainbow Balloons, Inc.");
    expect(discovery.companyOverviewDetails?.industry?.toLowerCase()).toMatch(/wholesale|party|event/);
    expect(discovery.companyOverviewDetails?.location).toContain("Woburn, MA");
    expect(discovery.companyOverviewDetails?.businessModel?.toLowerCase()).toContain("b2b");
    expect(discovery.companyOverviewDetails?.businessHistory).toBeTruthy();
    expect(discovery.companyOverviewDetails?.digitalOperationsSummary).toBeTruthy();

    // 3. Needs and recommendations must focus on B2B wholesale eCommerce / catalog / portal
    const needsBlob = discovery.currentNeeds.join(" ").toLowerCase();
    expect(needsBlob).toMatch(/ecommerce|b2b|wholesale|portal|ordering/);

    const recsBlob = discovery.recommendations.join(" ").toLowerCase();
    expect(recsBlob).toMatch(/ecommerce|wholesale|b2b|portal/);

    // 4. Matrix Fit & Worth Time
    expect(discovery.fitAssessment?.fitLevel).toBe("EXCELLENT");
    expect(discovery.fitAssessment?.isWorthTime).toBe(true);
    expect(discovery.fitAssessment?.fitScore).toBeGreaterThanOrEqual(80);
  });

  describe("SSRF Protection (isSafePublicUrl)", () => {
    it("blocks private IPs, localhost, and cloud metadata endpoints", () => {
      // Loopback
      expect(isSafePublicUrl("http://localhost:3000")).toBe(false);
      expect(isSafePublicUrl("http://localhost/admin")).toBe(false);
      expect(isSafePublicUrl("http://127.0.0.1:8080")).toBe(false);
      expect(isSafePublicUrl("http://127.0.0.2")).toBe(false);

      // Cloud Metadata / Link Local
      expect(isSafePublicUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
      expect(isSafePublicUrl("http://169.254.1.1")).toBe(false);

      // RFC 1918 Private Subnets
      expect(isSafePublicUrl("http://10.0.0.1/dashboard")).toBe(false);
      expect(isSafePublicUrl("http://10.255.255.255")).toBe(false);
      expect(isSafePublicUrl("http://172.16.0.1")).toBe(false);
      expect(isSafePublicUrl("http://172.31.255.255")).toBe(false);
      expect(isSafePublicUrl("http://192.168.1.1/internal")).toBe(false);

      // Internal / Local TLDs
      expect(isSafePublicUrl("http://myserver.local")).toBe(false);
      expect(isSafePublicUrl("http://internal.service.lan")).toBe(false);
      expect(isSafePublicUrl("http://corp.internal")).toBe(false);

      // Unsupported protocols
      expect(isSafePublicUrl("file:///etc/passwd")).toBe(false);
      expect(isSafePublicUrl("ftp://files.example.com")).toBe(false);
      expect(isSafePublicUrl("javascript:alert(1)")).toBe(false);
    });

    it("permits legitimate, safe public domains and URLs", () => {
      expect(isSafePublicUrl("https://rainbowballoons.com")).toBe(true);
      expect(isSafePublicUrl("https://www.leavesfloraldesign.com/")).toBe(true);
      expect(isSafePublicUrl("https://techfluxsolutions.com/portfolio")).toBe(true);
      expect(isSafePublicUrl("https://subdomain.agency.co.uk")).toBe(true);
    });
  });

  describe("100-Point Lead Qualification Rubric", () => {
    it("transparently scores dimensions and treats unprovided fields as Unknown without penalty", () => {
      const minimalLead = {
        id: "lead_rubric_test_1",
        companyName: "Acme Regional Supply",
        jobTitle: "Operations Manager",
        description: "Looking to modernize wholesale order management portal.",
        source: "Inbound Inquiry",
        rating: "Warm",
      };

      const rubric = calculateQualificationRubric(
        minimalLead,
        null,
        "Wholesale Distribution",
        "Custom Web Portal",
        ["Modernizing customer intake portal"]
      );

      // Total score must be between 0 and 100
      expect(rubric.totalScore).toBeGreaterThanOrEqual(0);
      expect(rubric.totalScore).toBeLessThanOrEqual(100);

      // Category should be assigned
      expect(["High Priority", "Medium Priority", "Low Priority", "Insufficient Information"]).toContain(rubric.category);

      // Check all 7 dimensions exist
      expect(rubric.dimensionScores.fitWithServices).toBeGreaterThan(0);
      expect(rubric.dimensionScores.evidenceOfNeed).toBeGreaterThan(0);
      expect(rubric.dimensionScores.buyingIntent).toBeGreaterThan(0);
      expect(rubric.dimensionScores.decisionMakerAccess).toBeGreaterThan(0);

      // Unprovided fields must default to Unknown
      expect(rubric.timelineStatus).toBe("Unknown");
      expect(rubric.budgetStatus).toBe("Unknown");

      // Rationale must explain that missing fields are discovery agenda items, not penalties
      const rationaleText = rubric.rationale.join(" ").toLowerCase();
      expect(rationaleText).toContain("discovery");
      expect(rationaleText).toContain("not negative penalty");

      // Recommended next action must be present
      expect(rubric.recommendedNextAction).toBeTruthy();
    });
  });

  describe("Evidence Status Tagging & Conservative Project Estimation", () => {
    it("tags discovery opportunities with explicit evidence status and defaults project estimate to Not enough information", () => {
      const testLead = {
        id: "lead_evidence_test",
        fullName: "Marcus Vance",
        companyName: "Vance Architecture Group",
        jobTitle: "Principal Architect",
        email: "marcus@vancearch.com",
        description: "Architecture firm interested in showcasing high-end commercial projects to regional developers.",
        source: "Referral",
      };

      const discovery = synthesizeHeuristicDiscovery(testLead);

      // 1. Discovery Opportunities must have explicit evidence status and validation questions
      expect(discovery.discoveryOpportunities).toBeDefined();
      expect(discovery.discoveryOpportunities!.length).toBeGreaterThan(0);
      discovery.discoveryOpportunities!.forEach((opp) => {
        expect(["Verified Fact", "Reasonable Hypothesis", "Needs Client Confirmation"]).toContain(
          opp.evidenceStatus
        );
        expect(["High", "Medium", "Low"]).toContain(opp.confidence);
        expect(opp.clientValidationQuestion).toBeTruthy();
      });

      // 2. 5 Priority Discovery Questions for call agenda
      expect(discovery.discoveryQuestions).toBeDefined();
      expect(discovery.discoveryQuestions!.priorityQuestions.length).toBe(5);
      expect(discovery.discoveryQuestions!.followUpQuestions.length).toBeGreaterThanOrEqual(2);

      // 3. Conservative Project Estimate
      expect(discovery.projectEstimate).toBeDefined();
      expect(discovery.projectEstimate!.status).toBe("Not enough information");
      expect(discovery.projectEstimate!.reason).toBe(
        "Requirements and implementation scope have not been confirmed"
      );
      expect(discovery.projectEstimate!.valueRange).toBeNull();
      expect(discovery.projectEstimate!.confidence).toBe("Low");

      // 4. Grounded Opening Hook (eliminating exaggerated antipatterns)
      expect(discovery.openingHookDetails).toBeDefined();
      expect(discovery.openingHookDetails!.text).toBeTruthy();
      expect(discovery.openingHookDetails!.text.toLowerCase()).not.toContain(
        "tremendous growth potential"
      );
      expect(discovery.openingHookDetails!.avoidedAntipatterns.length).toBeGreaterThan(0);

      // 5. Research Metadata & Sources
      expect(discovery.researchMetadata).toBeDefined();
      expect(discovery.researchMetadata!.limitations.length).toBeGreaterThan(0);
      expect(discovery.researchMetadata!.promptVersion).toBe("lead-discovery-v2");
    });
  });

  describe("Tailored Sales Outreach Email Draft (Quick Meeting Invite)", () => {
    it("generates bespoke, human-sounding outreach email draft with low-friction meeting CTA", () => {
      const testLead = {
        id: "lead_email_test_1",
        firstName: "Johnny",
        fullName: "Johnny Huynh",
        companyName: "Bayview Luxury Suites & Hospitality",
        jobTitle: "General Manager",
        email: "johnny@bayviewsuites.com",
        description: "Boutique luxury resort seeking to increase direct reservations.",
        source: "Referral",
      };

      const discovery = synthesizeHeuristicDiscovery(testLead);

      expect(discovery.outreachEmailDraft).toBeDefined();
      const draft = discovery.outreachEmailDraft!;

      // Subject must be human and mention first name or company
      expect(draft.subject).toBeTruthy();
      expect(draft.subject.toLowerCase()).toContain("johnny");

      // Body must be human, concise, and contain a low-friction meeting CTA
      expect(draft.body).toBeTruthy();
      expect(draft.body).toContain("Johnny");
      expect(draft.body.toLowerCase()).toContain("bayview");
      expect(draft.body.toLowerCase()).toMatch(/10(?:-|\s*)15\s*minute|10\s*minute/i);
      expect(draft.body.toLowerCase()).toMatch(/conversation|chat|notes/i);

      // Purpose & suggested CTA
      expect(draft.purpose).toBe("Introductory Discovery & Quick Meeting Request");
      expect(draft.suggestedMeetingCta).toBe("10-15 minute introductory conversation");

      // Verify concise word count (under 120 words)
      const wordCount = draft.body.trim().split(/\s+/).length;
      expect(wordCount).toBeLessThan(120);
      expect(wordCount).toBeGreaterThan(30);
    });

    it("strictly rejects discovery generation when research sources (website, personal LinkedIn, company LinkedIn) are missing", async () => {
      mockLeadsStore.push({
        id: "lead_no_sources_99",
        organizationId: "org_discovery_test",
        leadNumber: "LEAD-9999",
        firstName: "No",
        lastName: "Footprint",
        fullName: "No Footprint",
        email: "test@gmail.com",
        phone: "+1 555-9999",
        source: "Manual",
        status: "New",
        rating: "Cold",
        estimatedValue: 0,
        currency: "USD",
        createdAt: new Date().toISOString(),
        description: "No website or social profiles provided.",
      });

      const res = await generateLeadDiscoveryAction("lead_no_sources_99", { forceRefresh: true });
      expect(res.success).toBe(false);
      expect(res.error).toContain("research source");
      expect(res.error).toContain("Company Website, Personal LinkedIn, or Company LinkedIn URL");
    });

    it("allows discovery generation when lead has personal or company LinkedIn URL", async () => {
      mockLeadsStore.push({
        id: "lead_linkedin_only",
        organizationId: "org_discovery_test",
        leadNumber: "LEAD-8888",
        firstName: "Jane",
        lastName: "Executive",
        fullName: "Jane Executive",
        customerLinkedin: "https://www.linkedin.com/in/jane-executive",
        source: "Manual",
        status: "New",
        rating: "Warm",
        estimatedValue: 10000,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });

      const res = await generateLeadDiscoveryAction("lead_linkedin_only", { forceRefresh: true });
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
    });

    it("strictly rejects discovery generation when research URL is unreachable and lead has no substantive description notes", async () => {
      mockLeadsStore.push({
        id: "lead_unreachable_site_mohsin",
        organizationId: "org_discovery_test",
        leadNumber: "LEAD-7777",
        firstName: "Mohsin",
        lastName: "Owner",
        fullName: "Mohsin",
        email: "mohsin@bellawoman.com",
        website: "https://www.bellawoman.com/",
        source: "Direct",
        status: "New",
        rating: "Cold",
        estimatedValue: 0,
        currency: "USD",
        createdAt: new Date().toISOString(),
        description: "",
      });

      const res = await generateLeadDiscoveryAction("lead_unreachable_site_mohsin", { forceRefresh: true });
      expect(res.success).toBe(false);
      expect(res.error).toContain("not working or is unreachable");
      expect(res.error).toContain("bellawoman.com");
    });

    it("accurately synthesizes unique discovery for Women's Fashion & Apparel Boutique without generic commercial operations boilerplate", () => {
      const discovery = synthesizeHeuristicDiscovery(
        {
          id: "lead_bella_fashion",
          fullName: "Mohsin",
          firstName: "Mohsin",
          companyName: "Bella Woman Boutique",
          website: "https://www.bellawoman.com",
          email: "contact@bellawoman.com",
          description: "Curated women's fashion apparel, seasonal dresses, evening wear collections, and boutique accessories.",
        },
        {
          websiteUrl: "https://roxx-crm.com",
          serviceOfferings: ["Web Design", "Web Development", "SEO & Search Visibility"],
        }
      );

      expect(discovery.clientBusiness).toContain("Women's Fashion");
      expect(discovery.businessSummary.toLowerCase()).toContain("fashion");
      expect(discovery.businessSummary.toLowerCase()).not.toContain("commercial enterprise");
      expect(discovery.targetOffering.toLowerCase()).toContain("fashion");
      expect(discovery.recommendations.some((r) => r.toLowerCase().includes("fashion") || r.toLowerCase().includes("lookbook"))).toBe(true);
      expect(discovery.talkingPoints.some((p) => p.toLowerCase().includes("mobile") || p.toLowerCase().includes("collection"))).toBe(true);
    });

    it("verifies URL reachability via checkLeadResearchUrlAction", async () => {
      const safeLinkedin = await checkLeadResearchUrlAction("https://www.linkedin.com/company/roxx-crm");
      expect(safeLinkedin.isWorking).toBe(true);
      expect(safeLinkedin.title).toContain("Roxx Crm");

      const blockedSsrf = await checkLeadResearchUrlAction("http://127.0.0.1:8080");
      expect(blockedSsrf.isWorking).toBe(false);
      expect(blockedSsrf.error).toContain("security policy");
    });
  });
});
