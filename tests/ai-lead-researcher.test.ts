import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  researchLeadAndDraftEmail,
  type LeadProfileInput,
} from "@/lib/ai/lead-researcher";
import {
  mockLeadsStore,
  mockAiConfigsStore,
} from "@/lib/db/mock-store";
import { generateLeadAiEmailAction } from "@/actions/ai-email";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_rep_1",
  organizationId: "org_ai_test",
  organizationName: "Vanguard Systems",
  email: "alex@vanguard.com",
  name: "Alex Sales",
  role: "SALES_REP",
  permissions: ["lead:create", "activity:create"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

describe("AI Lead Researcher & Copywriter Engine", () => {
  beforeEach(() => {
    mockLeadsStore.length = 0;
  });

  it("should extract deep seniority and department insights from lead role", async () => {
    const lead: LeadProfileInput = {
      id: "lead_1",
      firstName: "Sarah",
      lastName: "Connor",
      fullName: "Sarah Connor",
      email: "sarah@cyberdyne.io",
      companyName: "Cyberdyne Systems",
      jobTitle: "VP of Engineering & Cloud Infrastructure",
      website: "https://cyberdyne.io",
      linkedinUrl: "https://linkedin.com/in/sarah-connor",
    };

    const result = await researchLeadAndDraftEmail(lead, {
      objective: "INITIAL_OUTREACH",
      tone: "EXECUTIVE",
      valueProposition: "We help cloud engineering teams reduce deployment pipeline outages.",
    });

    // Verify Research Brief
    expect(result.researchBrief).toBeDefined();
    expect(result.researchBrief.seniorityLevel).toBe("VP / Vice President");
    expect(result.researchBrief.department).toBe("Engineering & Product");
    expect(result.researchBrief.personaInsights.length).toBeGreaterThan(0);
    expect(result.researchBrief.personalizedHook).toContain("Cyberdyne Systems");

    // Verify Bespoke Email
    expect(result.subject).toBeDefined();
    expect(result.body).toBeDefined();
    expect(result.body).toContain("Sarah");
    expect(result.body).toContain("Cyberdyne Systems");

    // Verify Deliverability Analysis
    expect(result.deliverabilityScore).toBeGreaterThanOrEqual(80);
    expect(result.wordCount).toBeGreaterThan(30);
    expect(result.wordCount).toBeLessThan(350);
  });

  it("should adapt pitch and tone for Sales Leadership (VP of Sales, WARM)", async () => {
    const lead: LeadProfileInput = {
      id: "lead_2",
      firstName: "Marcus",
      lastName: "Vance",
      fullName: "Marcus Vance",
      email: "marcus@growthscale.com",
      companyName: "Growth Scale Inc",
      jobTitle: "Head of Sales",
      website: "https://growthscale.com",
    };

    const result = await researchLeadAndDraftEmail(lead, {
      objective: "MEETING_INVITE",
      tone: "WARM",
    });

    expect(result.researchBrief.seniorityLevel).toBe("Director / Head of Department");
    expect(result.researchBrief.department).toBe("Sales & Business Development");
    expect(result.subject).toBeDefined();
    expect(result.body).toContain("Marcus");
    expect(result.body).toContain("Growth Scale Inc");
    expect(result.deliverabilityScore).toBeGreaterThanOrEqual(85);
  });

  it("should adapt to Founders & C-Level executives (CEO, CONSULTATIVE)", async () => {
    const lead: LeadProfileInput = {
      id: "lead_3",
      firstName: "Elena",
      lastName: "Rostova",
      fullName: "Elena Rostova",
      email: "elena@apextech.com",
      companyName: "Apex Technologies",
      jobTitle: "Founder & CEO",
      linkedinUrl: "https://linkedin.com/in/elenarostova",
    };

    const result = await researchLeadAndDraftEmail(lead, {
      objective: "VALUE_CASE_STUDY",
      tone: "CONSULTATIVE",
      customInstruction: "Emphasize how we helped a peer SaaS achieve 3x pipeline velocity",
    });

    expect(result.researchBrief.seniorityLevel).toBe("C-Level / Executive");
    expect(result.researchBrief.department).toBe("Executive Leadership");
    expect(result.body).toContain("Elena");
    expect(result.body).toContain("Apex Technologies");
    expect(result.researchBrief.linkedinPresence).toBe("Active LinkedIn Profile detected");
  });

  it("should gracefully handle leads with minimal profile information", async () => {
    const minimalLead: LeadProfileInput = {
      id: "lead_4",
      firstName: "Jordan",
      email: "jordan@startup.co",
    };

    const result = await researchLeadAndDraftEmail(minimalLead, {
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
    });

    expect(result.subject).toBeDefined();
    expect(result.body).toContain("Jordan");
    expect(result.researchBrief.seniorityLevel).toBe("Individual Contributor / Lead");
    expect(result.deliverabilityScore).toBeGreaterThanOrEqual(80);
  });

  it("should integrate with generateLeadAiEmailAction server action", async () => {
    mockLeadsStore.push({
      id: "lead_action_test",
      leadNumber: "LD-9901",
      organizationId: "org_ai_test",
      firstName: "David",
      lastName: "Kim",
      fullName: "David Kim",
      email: "david@fintechpulse.com",
      phone: "+1 555-0199",
      companyName: "Fintech Pulse",
      jobTitle: "Chief Technology Officer",
      website: "https://fintechpulse.com",
      status: "NEW",
      rating: "HOT",
      assignedToId: "usr_rep_1",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);

    const res = await generateLeadAiEmailAction({
      leadId: "lead_action_test",
      objective: "INITIAL_OUTREACH",
      tone: "EXECUTIVE",
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.suggestion.subject).toBeDefined();
    expect(res.data?.suggestion.body).toContain("David");
    expect(res.data?.researchBrief.seniorityLevel).toBe("C-Level / Executive");
    expect(res.data?.deliverability.score).toBeGreaterThanOrEqual(80);
  });
});
