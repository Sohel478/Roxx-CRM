import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockAiCampaignsStore,
  mockLeadsStore,
  mockUsersStore,
} from "@/lib/db/mock-store";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_admin_1",
  organizationId: "org_assign_test",
  organizationName: "Assignment Test Org",
  email: "admin@roxx-crm.com",
  name: "Admin User",
  role: "ADMIN",
  permissions: ["batch:manage", "lead:manage"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

import {
  createMarketingBatchAction,
  assignMarketingBatchAction,
  getMarketingBatchByIdAction,
} from "@/actions/marketing";
import {
  generateLeadAiEmailAction,
  studyMarketingBatchAiAction,
  scheduleAiBatchCampaignAction,
} from "@/actions/ai-email";

describe("Marketing Batch Assignment & Strict AI Guardrails", () => {
  beforeEach(() => {
    mockMarketingBatchesStore.length = 0;
    mockMarketingCampaignsStore.length = 0;
    mockAiCampaignsStore.length = 0;
    mockLeadsStore.length = 0;
    mockUsersStore.length = 0;

    // Seed mock sales reps
    mockUsersStore.push(
      {
        id: "usr_sales_sarah",
        organizationId: "org_assign_test",
        name: "Sarah Miller",
        email: "sarah@roxx-crm.com",
        role: "SALES_REP",
        isActive: true,
        createdAt: new Date().toISOString(),
      },
      {
        id: "usr_sales_david",
        organizationId: "org_assign_test",
        name: "David Kim",
        email: "david@roxx-crm.com",
        role: "SALES_REP",
        isActive: true,
        createdAt: new Date().toISOString(),
      }
    );

    // Seed test leads
    mockLeadsStore.push(
      {
        id: "lead_assign_1",
        organizationId: "org_assign_test",
        leadNumber: "LD-001",
        fullName: "Marcus Aurelius",
        companyName: "Acme Cloud Corp",
        email: "marcus@acmecloud.com",
        phone: "+1-555-1234",
        status: "NEW",
        rating: "Hot",
        jobTitle: "VP of Engineering",
        industry: "Cloud & DevOps",
        ownerId: null,
        ownerName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "lead_assign_2",
        organizationId: "org_assign_test",
        leadNumber: "LD-002",
        fullName: "Elena Rostova",
        companyName: "FinTech Prime",
        email: "elena@fintechprime.io",
        phone: "+1-555-5678",
        status: "CONTACTED",
        rating: "Warm",
        jobTitle: "Chief Technology Officer",
        industry: "Financial Technology",
        ownerId: null,
        ownerName: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  });

  it("should create a marketing batch assigned to a specific sales representative and assign leads to that rep", async () => {
    const res = await createMarketingBatchAction({
      name: "Q4 Enterprise Tech Outreach",
      description: "Assigned to Sarah for dedicated outreach",
      assignedToId: "usr_sales_sarah",
      assignLeadsToRep: true,
      leadIds: ["lead_assign_1", "lead_assign_2"],
    });

    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data?.assignedToId).toBe("usr_sales_sarah");
    expect(res.data?.assignedToName).toBe("Sarah Miller");
    expect(res.data?.assignedToEmail).toBe("sarah@roxx-crm.com");
    expect(res.data?.ownerId).toBe("usr_sales_sarah");

    // Check that member leads were also assigned to Sarah
    const lead1 = mockLeadsStore.find((l) => l.id === "lead_assign_1");
    const lead2 = mockLeadsStore.find((l) => l.id === "lead_assign_2");
    expect(lead1?.ownerId).toBe("usr_sales_sarah");
    expect(lead1?.ownerName).toBe("Sarah Miller");
    expect(lead2?.ownerId).toBe("usr_sales_sarah");
    expect(lead2?.ownerName).toBe("Sarah Miller");
  });

  it("should allow reassigning a batch and member leads to a different sales representative", async () => {
    const createRes = await createMarketingBatchAction({
      name: "Q4 Reassign Batch",
      assignedToId: "usr_sales_sarah",
      assignLeadsToRep: true,
      leadIds: ["lead_assign_1"],
    });
    expect(createRes.success).toBe(true);
    const batchId = createRes.data!.id;

    // Reassign to David Kim
    const reassignRes = await assignMarketingBatchAction({
      batchId,
      assignedToId: "usr_sales_david",
      assignLeadsToRep: true,
    });

    expect(reassignRes.success).toBe(true);

    const detailRes = await getMarketingBatchByIdAction(batchId);
    expect(detailRes.success).toBe(true);
    expect(detailRes.data?.assignedToId).toBe("usr_sales_david");
    expect(detailRes.data?.assignedToName).toBe("David Kim");
    expect(detailRes.data?.assignedToEmail).toBe("david@roxx-crm.com");

    const lead1 = mockLeadsStore.find((l) => l.id === "lead_assign_1");
    expect(lead1?.ownerId).toBe("usr_sales_david");
    expect(lead1?.ownerName).toBe("David Kim");
  });

  it("STRICT GUARDRAIL: AI must refuse to study or pick leads for an unassigned batch", async () => {
    // Create an unassigned batch manually in mock store
    const unassignedBatchId = "batch_unassigned_999";
    mockMarketingBatchesStore.push({
      id: unassignedBatchId,
      organizationId: "org_assign_test",
      name: "Unassigned Rogue Batch",
      ownerId: "" as any,
      ownerName: null,
      assignedToId: null,
      assignedToName: null,
      assignedToEmail: null,
      leadIds: ["lead_assign_1"],
      leadCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const studyRes = await studyMarketingBatchAiAction({
      batchId: unassignedBatchId,
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
    });

    expect(studyRes.success).toBe(false);
    expect(studyRes.error).toContain("This batch is not assigned to any sales representative");
    expect(studyRes.error).toContain("You must assign a team member to do the job before AI can study or email leads");
  });

  it("STRICT GUARDRAIL: AI must refuse to generate an outreach email for an unassigned lead", async () => {
    // lead_assign_1 has ownerId: null
    const lead1 = mockLeadsStore.find((l) => l.id === "lead_assign_1");
    expect(lead1?.ownerId).toBeNull();

    const generateRes = await generateLeadAiEmailAction({
      leadId: "lead_assign_1",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
    });

    expect(generateRes.success).toBe(false);
    expect(generateRes.error).toContain("This lead is unassigned");
    expect(generateRes.error).toContain("Please assign an owner or sales representative to this lead before AI can research and email them");
  });

  it("AI outreach uses assigned sales representative identity for research brief and email signoff", async () => {
    // 1. Assign batch to Sarah
    const createRes = await createMarketingBatchAction({
      name: "Sarah's Cloud Batch",
      assignedToId: "usr_sales_sarah",
      assignLeadsToRep: true,
      leadIds: ["lead_assign_1"],
    });
    expect(createRes.success).toBe(true);
    const batchId = createRes.data!.id;

    // 2. Study batch with AI
    const studyRes = await studyMarketingBatchAiAction({
      batchId,
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
    });

    expect(studyRes.success).toBe(true);
    expect(studyRes.data).toBeDefined();
    expect(studyRes.data?.leads.length).toBe(1);

    const leadDraft = studyRes.data!.leads[0];
    expect(leadDraft.initialEmail.body).toContain("Sarah Miller");

    // 3. Schedule Campaign - creator should be the assigned rep
    const scheduleRes = await scheduleAiBatchCampaignAction({
      batchId,
      campaignName: "Sarah's Scheduled AI Outreach",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
      startDate: "now",
      pacingMinutes: 2,
      enableFollowUp: true,
      followUpDays: 3,
      leads: [
        {
          leadId: leadDraft.leadId,
          leadName: leadDraft.leadName,
          leadEmail: leadDraft.leadEmail,
          companyName: leadDraft.companyName,
          jobTitle: leadDraft.jobTitle,
          initialSubject: leadDraft.initialEmail.subject,
          initialBody: leadDraft.initialEmail.body,
        },
      ],
    });

    expect(scheduleRes.success).toBe(true);
    const campaignId = scheduleRes.data?.campaignId;
    const campaign = mockAiCampaignsStore.find((c) => c.id === campaignId);
    expect(campaign).toBeDefined();
    expect(campaign?.creatorId).toBe("usr_sales_sarah");
    expect(campaign?.creatorName).toBe("Sarah Miller");
  });
});
