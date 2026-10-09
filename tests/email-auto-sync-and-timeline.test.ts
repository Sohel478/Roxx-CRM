import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockActivitiesStore,
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockAiCampaignsStore,
  mockInboxStore,
  mockLeadsStore,
} from "@/lib/db/mock-store";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_rep_1",
  organizationId: "org_sync_test",
  organizationName: "Sync Test Org",
  email: "alex@roxx-crm.com",
  name: "Alex Sales",
  role: "SALES_REP",
  permissions: ["activity:create", "activity:read", "lead:create"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

import { getActivitiesAction, logActivityAction } from "@/actions/activities";
import { syncLeadEmailsAction } from "@/actions/inbox";

describe("Email Timeline Visibility & Background Auto-Sync", () => {
  beforeEach(() => {
    mockActivitiesStore.length = 0;
    mockMarketingBatchesStore.length = 0;
    mockMarketingCampaignsStore.length = 0;
    mockAiCampaignsStore.length = 0;
    mockInboxStore.length = 0;
    mockLeadsStore.length = 0;

    // Seed test lead
    mockLeadsStore.push({
      id: "lead_kubins_1",
      organizationId: "org_sync_test",
      leadNumber: "LEAD-KUB",
      firstName: "Kubins",
      lastName: "HQ",
      fullName: "Kubins HQ",
      email: "contact@kubins.com",
      supportEmail: "support@kubins.com",
      phone: "+1 555-0999",
      companyName: "Kubins Corp",
      jobTitle: "Founder",
      source: "Website",
      status: "New",
      rating: "Hot",
      estimatedValue: 50000,
      currency: "USD",
      ownerId: "usr_rep_1",
      ownerName: "Alex Sales",
      createdById: "usr_rep_1",
      createdAt: new Date().toISOString(),
    });
  });

  it("displays 1:1 direct email logged to lead in activity timeline", async () => {
    await logActivityAction({
      type: "EMAIL",
      subject: "Partnership Discussion with Kubins",
      description: "To: contact@kubins.com\n\nHi Kubins team, excited to connect!",
      leadId: "lead_kubins_1",
    });

    const res = await getActivitiesAction({ leadId: "lead_kubins_1" });
    expect(res.success).toBe(true);
    expect(res.data?.items.length).toBe(1);
    expect(res.data?.items[0].subject).toBe("Partnership Discussion with Kubins");
    expect(res.data?.items[0].type).toBe("EMAIL");
    expect(res.data?.summary.emailsCount).toBe(1);
  });

  it("aggregates emails sent via Marketing Campaigns into lead interaction timeline", async () => {
    mockMarketingCampaignsStore.push({
      id: "camp_marketing_1",
      batchId: "batch_1",
      organizationId: "org_sync_test",
      senderId: "usr_rep_1",
      senderName: "Alex Sales",
      senderEmail: "alex@roxx-crm.com",
      subject: "Special Summer Promotion for Kubins",
      body: "Hello Kubins team, check out our summer enterprise offer.",
      status: "SENT",
      totalRecipients: 1,
      sentCount: 1,
      failedCount: 0,
      recipientLogs: [
        {
          leadId: "lead_kubins_1",
          leadName: "Kubins HQ",
          email: "contact@kubins.com",
          companyName: "Kubins Corp",
          status: "SENT",
          sentAt: new Date().toISOString(),
        },
      ],
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await getActivitiesAction({ leadId: "lead_kubins_1" });
    expect(res.success).toBe(true);

    const emailActivities = res.data?.items.filter((a) => a.type === "EMAIL");
    expect(emailActivities?.length).toBeGreaterThanOrEqual(1);
    expect(
      emailActivities?.some((a) => a.subject.includes("Special Summer Promotion"))
    ).toBe(true);
    expect(res.data?.summary.emailsCount).toBeGreaterThanOrEqual(1);
  });

  it("aggregates emails dispatched via AI Outreach campaigns into lead interaction timeline", async () => {
    mockAiCampaignsStore.push({
      id: "ai_camp_1",
      batchId: "batch_1",
      batchName: "Q4 High Value Leads",
      organizationId: "org_sync_test",
      campaignName: "Autonomous AI Outreach",
      outreachObjective: "Demo Booking",
      tone: "Professional",
      status: "ACTIVE",
      totalLeads: 1,
      sentCount: 1,
      repliedCount: 0,
      followUpCount: 0,
      enableFollowUp: true,
      followUpDelayDays: 3,
      pacingMinutes: 2,
      creatorId: "usr_rep_1",
      creatorName: "Alex Sales",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schedules: [
        {
          leadId: "lead_kubins_1",
          leadName: "Kubins HQ",
          leadEmail: "contact@kubins.com",
          companyName: "Kubins Corp",
          jobTitle: "Founder",
          initialSubject: "Tailored Growth Strategy for Kubins",
          initialBody: "Hi Kubins team, based on your online presence, we prepared an insight report.",
          status: "SENT",
          scheduledAt: new Date().toISOString(),
          sentAt: new Date().toISOString(),
          followUpScheduledAt: new Date(Date.now() + 86400000).toISOString(),
          followUpSubject: "Quick follow-up on Kubins growth strategy",
          followUpBody: "Checking in to see if you had a chance to review the initial insights.",
        },
      ],
    });

    const res = await getActivitiesAction({ leadId: "lead_kubins_1" });
    expect(res.success).toBe(true);

    const aiEmails = res.data?.items.filter((a) => a.type === "EMAIL");
    expect(aiEmails?.length).toBeGreaterThanOrEqual(1);
    expect(
      aiEmails?.some((a) => a.subject.includes("Tailored Growth Strategy for Kubins"))
    ).toBe(true);
  });

  it("aggregates incoming client replies from inbox store into lead interaction timeline", async () => {
    mockInboxStore.push({
      id: "inbox_msg_client_reply",
      organizationId: "org_sync_test",
      fromEmail: "contact@kubins.com",
      fromName: "Kubins Team",
      toEmail: "alex@roxx-crm.com",
      subject: "Re: Tailored Growth Strategy for Kubins",
      bodyText: "Thanks Alex! We would love to book a 15-minute demo on Friday.",
      snippet: "Thanks Alex! We would love to book a 15-minute demo on Friday.",
      date: new Date().toISOString(),
      isRead: false,
      leadId: "lead_kubins_1",
      leadName: "Kubins HQ",
    });

    const res = await getActivitiesAction({ leadId: "lead_kubins_1" });
    expect(res.success).toBe(true);

    const replyAct = res.data?.items.find((a) => a.outcome === "REPLY_RECEIVED");
    expect(replyAct).toBeDefined();
    expect(replyAct?.subject).toContain("Re: Tailored Growth Strategy");
    expect(replyAct?.description).toContain("Thanks Alex!");
  });

  it("syncLeadEmailsAction successfully runs synchronization and updates timestamp", async () => {
    const res = await syncLeadEmailsAction("lead_kubins_1");
    expect(res.success).toBe(true);
    expect(res.lastSyncedAt).toBeDefined();
    expect(typeof res.lastSyncedAt).toBe("string");
  });

  it("aggregates emails in global activity timeline when leadId is not specified", async () => {
    mockMarketingCampaignsStore.push({
      id: "camp_global_1",
      batchId: "batch_1",
      organizationId: "org_sync_test",
      senderId: "usr_rep_1",
      senderName: "Alex Sales",
      senderEmail: "alex@roxx-crm.com",
      subject: "Global Product Announcement",
      body: "Hello everyone, check out our new CRM features.",
      status: "SENT",
      totalRecipients: 1,
      sentCount: 1,
      failedCount: 0,
      recipientLogs: [
        {
          leadId: "lead_kubins_1",
          leadName: "Kubins HQ",
          email: "contact@kubins.com",
          companyName: "Kubins Corp",
          status: "SENT",
          sentAt: new Date().toISOString(),
        },
      ],
      sentAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const res = await getActivitiesAction({});
    expect(res.success).toBe(true);
    expect(res.data?.items.length).toBeGreaterThanOrEqual(1);
    expect(res.data?.items.some((a) => a.subject.includes("Global Product Announcement"))).toBe(true);
    expect(res.data?.summary.emailsCount).toBeGreaterThanOrEqual(1);
  });

  it("includes scheduled AI outreach items in timeline with outcome SCHEDULED", async () => {
    mockAiCampaignsStore.push({
      id: "ai_camp_scheduled",
      batchId: "batch_1",
      batchName: "Q4 High Value Leads",
      organizationId: "org_sync_test",
      campaignName: "Paced Outreach Campaign",
      outreachObjective: "Demo Booking",
      tone: "Professional",
      status: "ACTIVE",
      totalLeads: 1,
      sentCount: 0,
      repliedCount: 0,
      followUpCount: 0,
      enableFollowUp: false,
      followUpDelayDays: 3,
      pacingMinutes: 5,
      creatorId: "usr_rep_1",
      creatorName: "Alex Sales",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      schedules: [
        {
          leadId: "lead_kubins_1",
          leadName: "Kubins HQ",
          leadEmail: "contact@kubins.com",
          companyName: "Kubins Corp",
          jobTitle: "Founder",
          initialSubject: "Scheduled Intro to Kubins",
          initialBody: "Hi Kubins team, looking forward to connecting.",
          status: "SCHEDULED",
          scheduledAt: new Date(Date.now() + 300000).toISOString(),
        },
      ],
    });

    const res = await getActivitiesAction({ leadId: "lead_kubins_1" });
    expect(res.success).toBe(true);

    const scheduledItem = res.data?.items.find((a) => a.subject.includes("Scheduled Intro to Kubins"));
    expect(scheduledItem).toBeDefined();
    expect(scheduledItem?.outcome).toBe("SCHEDULED");
    expect(scheduledItem?.type).toBe("EMAIL");
  });
});
