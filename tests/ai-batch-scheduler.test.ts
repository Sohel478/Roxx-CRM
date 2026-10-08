import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMarketingBatchesStore,
  mockAiCampaignsStore,
  mockLeadsStore,
  mockActivitiesStore,
  mockAiConfigsStore,
} from "@/lib/db/mock-store";
import {
  studyMarketingBatchAiAction,
  scheduleAiBatchCampaignAction,
  getScheduledAiCampaignsAction,
  processScheduledAiQueueAction,
  getAiConfigAction,
  saveAiConfigAction,
} from "@/actions/ai-email";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_rep_1",
  organizationId: "org_ai_batch_test",
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

describe("Marketing AI Batch Study & Autonomous Scheduler Engine", () => {
  beforeEach(() => {
    mockMarketingBatchesStore.length = 0;
    mockAiCampaignsStore.length = 0;
    mockLeadsStore.length = 0;
    mockActivitiesStore.length = 0;

    // Seed 3 test leads
    mockLeadsStore.push(
      {
        id: "lead_b1",
        leadNumber: "LD-8001",
        organizationId: "org_ai_batch_test",
        firstName: "Alice",
        lastName: "Smith",
        fullName: "Alice Smith",
        email: "alice@finovate.io",
        companyName: "Finovate Labs",
        jobTitle: "VP of Product",
        website: "https://finovate.io",
        status: "NEW",
        rating: "HOT",
        assignedToId: "usr_rep_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
      {
        id: "lead_b2",
        leadNumber: "LD-8002",
        organizationId: "org_ai_batch_test",
        firstName: "Bob",
        lastName: "Jones",
        fullName: "Bob Jones",
        email: "bob@cloudscale.net",
        companyName: "CloudScale Systems",
        jobTitle: "Director of Engineering",
        status: "CONTACTED",
        rating: "WARM",
        assignedToId: "usr_rep_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
      {
        id: "lead_b3",
        leadNumber: "LD-8003",
        organizationId: "org_ai_batch_test",
        firstName: "Carol",
        lastName: "White",
        fullName: "Carol White",
        email: "carol@vanguardai.com",
        companyName: "Vanguard AI",
        jobTitle: "Chief Revenue Officer",
        status: "QUALIFIED",
        rating: "HOT",
        assignedToId: "usr_rep_1",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any
    );

    // Seed Marketing Batch
    mockMarketingBatchesStore.push({
      id: "batch_ai_1",
      organizationId: "org_ai_batch_test",
      name: "Q4 High-Growth Targets",
      description: "Autonomous AI outreach test batch",
      ownerId: "usr_rep_1",
      ownerName: "Alex Sales",
      leadIds: ["lead_b1", "lead_b2", "lead_b3"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  it("should study leads one-by-one in a batch and synthesize initial & follow-up copies", async () => {
    const studyRes = await studyMarketingBatchAiAction({
      batchId: "batch_ai_1",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
      valueProposition: "Accelerate pipeline velocity and automate client communication.",
      enableFollowUp: true,
      followUpDays: 3,
    });

    expect(studyRes.success).toBe(true);
    expect(studyRes.data).toBeDefined();

    const result = studyRes.data!;
    expect(result.batchId).toBe("batch_ai_1");
    expect(result.totalStudied).toBe(3);
    expect(result.leads.length).toBe(3);

    // Verify lead 1 study details
    const lead1 = result.leads[0];
    expect(lead1.leadName).toBe("Alice Smith");
    expect(lead1.companyName).toBe("Finovate Labs");
    expect(lead1.initialEmail.subject).toBeDefined();
    expect(lead1.initialEmail.body).toContain("Alice");
    expect(lead1.initialEmail.body).toContain("Finovate Labs");
    expect(lead1.followUpEmail?.subject).toBeDefined();
    expect(lead1.followUpEmail?.body).toBeDefined();
    expect(lead1.initialEmail.deliverabilityScore).toBeGreaterThanOrEqual(80);

    // Verify lead 2 study details
    const lead2 = result.leads[1];
    expect(lead2.leadName).toBe("Bob Jones");
    expect(lead2.initialEmail.body).toContain("Bob");
  });

  it("should schedule an autonomous campaign with staggered timestamps and cadences", async () => {
    const scheduleRes = await scheduleAiBatchCampaignAction({
      batchId: "batch_ai_1",
      campaignName: "Q4 Autonomous Sequence",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
      startDate: "now",
      pacingMinutes: 2,
      enableFollowUp: true,
      followUpDays: 3,
      leads: [
        {
          leadId: "lead_b1",
          leadName: "Alice Smith",
          leadEmail: "alice@finovate.io",
          companyName: "Finovate Labs",
          jobTitle: "VP of Product",
          initialSubject: "Finovate Labs pipeline velocity",
          initialBody: "Hi Alice,\n\nI noticed your work at Finovate Labs...",
          followUpSubject: "Quick follow up on Finovate Labs",
          followUpBody: "Hi Alice,\n\nFollowing up to see if you had a moment...",
        },
        {
          leadId: "lead_b2",
          leadName: "Bob Jones",
          leadEmail: "bob@cloudscale.net",
          companyName: "CloudScale Systems",
          jobTitle: "Director of Engineering",
          initialSubject: "CloudScale Systems cloud operations",
          initialBody: "Hi Bob,\n\nReaching out regarding CloudScale Systems...",
          followUpSubject: "Following up Bob",
          followUpBody: "Hi Bob,\n\nChecking back on this note...",
        },
      ],
    });

    expect(scheduleRes.success).toBe(true);
    expect(scheduleRes.data).toBeDefined();
    expect(scheduleRes.data?.totalScheduled).toBe(2);

    const campaigns = await getScheduledAiCampaignsAction();
    expect(campaigns.success).toBe(true);
    expect(campaigns.data?.length).toBe(1);

    const saved = campaigns.data![0];
    expect(saved.name).toBe("Q4 Autonomous Sequence");
    expect(saved.pacingMinutes).toBe(2);
    expect(saved.schedules.length).toBe(2);

    // Verify staggered dispatch times
    const time0 = new Date(saved.schedules[0].scheduledAt).getTime();
    const time1 = new Date(saved.schedules[1].scheduledAt).getTime();
    expect(time1 - time0).toBe(2 * 60 * 1000); // 2 minutes interval
  });

  it("should process due emails and advance status to AWAITING_REPLY", async () => {
    // Schedule campaign starting in the past
    const pastTime = new Date(Date.now() - 600000).toISOString();
    await scheduleAiBatchCampaignAction({
      batchId: "batch_ai_1",
      campaignName: "Due Immediate Campaign",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
      startDate: pastTime,
      pacingMinutes: 1,
      enableFollowUp: true,
      followUpDays: 3,
      leads: [
        {
          leadId: "lead_b1",
          leadName: "Alice Smith",
          leadEmail: "alice@finovate.io",
          companyName: "Finovate Labs",
          initialSubject: "Subject 1",
          initialBody: "Body 1",
          followUpSubject: "Follow Up 1",
          followUpBody: "Follow Up Body 1",
        },
      ],
    });

    const processRes = await processScheduledAiQueueAction();
    expect(processRes.success).toBe(true);
    expect(processRes.data?.sentInitialCount).toBe(1);

    const campaigns = await getScheduledAiCampaignsAction();
    const camp = campaigns.data![0];
    expect(camp.sentCount).toBe(1);
    expect(camp.schedules[0].status).toBe("AWAITING_REPLY");
  });

  it("should detect replies in CRM activities and stop follow-up automatically", async () => {
    // Schedule campaign starting 1 minute ago with 3-day follow-up
    const pastTime = new Date(Date.now() - 60000).toISOString();
    await scheduleAiBatchCampaignAction({
      batchId: "batch_ai_1",
      campaignName: "Reply Intercept Campaign",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
      startDate: pastTime,
      pacingMinutes: 1,
      enableFollowUp: true,
      followUpDays: 3,
      leads: [
        {
          leadId: "lead_b1",
          leadName: "Alice Smith",
          leadEmail: "alice@finovate.io",
          companyName: "Finovate Labs",
          initialSubject: "Subject 1",
          initialBody: "Body 1",
          followUpSubject: "Follow Up 1",
          followUpBody: "Follow Up Body 1",
        },
      ],
    });

    // Run first dispatch - should send initial and wait for reply
    const firstRes = await processScheduledAiQueueAction();
    expect(firstRes.data?.sentInitialCount).toBe(1);
    expect(firstRes.data?.sentFollowUpCount).toBe(0);

    // Now simulate lead replied
    mockActivitiesStore.push({
      id: "act_reply_1",
      leadId: "lead_b1",
      type: "EMAIL",
      outcome: "REPLY_RECEIVED",
      subject: "Re: Subject 1",
      description: "Thanks for reaching out! Let's chat next Tuesday.",
      activityAt: new Date().toISOString(),
      performedById: "usr_rep_1",
    } as any);

    // Fast-forward follow-up scheduled time to past
    const camp = mockAiCampaignsStore[0];
    camp.schedules[0].followUpScheduledAt = new Date(Date.now() - 1000).toISOString();

    // Run processor again - should detect reply and cancel follow-up
    const processRes2 = await processScheduledAiQueueAction();
    expect(processRes2.success).toBe(true);
    expect(processRes2.data?.repliesDetectedCount).toBe(1);
    expect(processRes2.data?.sentFollowUpCount).toBe(0); // Should NOT send follow up

    expect(camp.schedules[0].status).toBe("REPLIED");
    expect(camp.repliedCount).toBe(1);
  });

  it("should dispatch Step 2 follow-up if no reply is detected when due", async () => {
    // Schedule campaign starting 1 minute ago with 3-day follow-up
    const pastTime = new Date(Date.now() - 60000).toISOString();
    await scheduleAiBatchCampaignAction({
      batchId: "batch_ai_1",
      campaignName: "Follow-up Due Campaign",
      objective: "INITIAL_OUTREACH",
      tone: "PROFESSIONAL",
      startDate: pastTime,
      pacingMinutes: 1,
      enableFollowUp: true,
      followUpDays: 3,
      leads: [
        {
          leadId: "lead_b2",
          leadName: "Bob Jones",
          leadEmail: "bob@cloudscale.net",
          companyName: "CloudScale Systems",
          initialSubject: "Subject 2",
          initialBody: "Body 2",
          followUpSubject: "Follow Up 2",
          followUpBody: "Follow Up Body 2",
        },
      ],
    });

    // First dispatch - sends initial only
    const firstRes = await processScheduledAiQueueAction();
    expect(firstRes.data?.sentInitialCount).toBe(1);
    expect(firstRes.data?.sentFollowUpCount).toBe(0);

    // Fast-forward follow-up scheduled time to past
    const camp = mockAiCampaignsStore[0];
    camp.schedules[0].followUpScheduledAt = new Date(Date.now() - 1000).toISOString();

    // Run processor again - Bob has not replied, so follow-up sends
    const processRes2 = await processScheduledAiQueueAction();
    expect(processRes2.success).toBe(true);
    expect(processRes2.data?.sentFollowUpCount).toBe(1);

    expect(camp.schedules[0].status).toBe("FOLLOW_UP_SENT");
    expect(camp.followUpCount).toBe(1);
    expect(camp.status).toBe("COMPLETED");
  });

  it("should get and save tenant AI settings correctly", async () => {
    const initialConfig = await getAiConfigAction();
    expect(initialConfig.success).toBe(true);
    expect(initialConfig.data?.aiProvider).toBe("builtin");

    const saveRes = await saveAiConfigAction({
      aiProvider: "openai",
      apiKey: "sk-proj-test123456789",
      defaultCompanyPitch: "World-class CRM automation platform",
      defaultFollowUpDays: 4,
      defaultPacingMinutes: 5,
    });

    expect(saveRes.success).toBe(true);

    const updatedConfig = await getAiConfigAction();
    expect(updatedConfig.data?.aiProvider).toBe("openai");
    expect(updatedConfig.data?.defaultCompanyPitch).toBe("World-class CRM automation platform");
    expect(updatedConfig.data?.defaultFollowUpDays).toBe(4);
    expect(updatedConfig.data?.defaultPacingMinutes).toBe(5);
  });
});
