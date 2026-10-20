import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockDirectEmailsStore,
  mockLeadsStore,
  mockActivitiesStore,
  mockSuppressedEmailsStore,
  mockSmtpStore,
} from "@/lib/db/mock-store";
import { encryptSecret } from "@/lib/crypto/encryption";
import {
  recordEmailOpen,
  recordEmailClick,
  recordEmailBounce,
  recordEmailUnsubscribe,
} from "@/lib/email/tracking";
import {
  getLeadEmailEngagementAction,
  simulateLeadEmailEngagementAction,
  sendTestTrackedEmailAction,
} from "@/actions/marketing";
import { sendEmailAction } from "@/actions/email";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth session
let mockSessionUser: any = {
  id: "usr_lead_rep",
  organizationId: "org_lead_test",
  organizationName: "Lead Engagement Org",
  email: "rep@roxx-crm.com",
  name: "Sarah Sales",
  role: "SALES_USER",
  permissions: ["activity:create", "lead:read", "lead:update"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

// Mock mailer
vi.mock("@/lib/email/mailer", () => ({
  sendSmtpEmail: vi.fn(async (_conn, opts) => {
    if (opts.to === "bounce-lead@example.com") {
      return {
        success: false,
        isBounce: true,
        bounceReason: "550 5.1.1 User unknown / mailbox unavailable",
        error: "550 5.1.1 User unknown / mailbox unavailable",
      };
    }
    return { success: true, messageId: `<msg-${Date.now()}@roxx-crm.com>` };
  }),
}));

describe("Lead Outbound Email Delivery & Engagement Status", () => {
  beforeEach(() => {
    mockMarketingBatchesStore.length = 0;
    mockMarketingCampaignsStore.length = 0;
    mockDirectEmailsStore.length = 0;
    mockLeadsStore.length = 0;
    mockActivitiesStore.length = 0;
    mockSuppressedEmailsStore.clear();

    mockSmtpStore["org_lead_test"] = {
      organizationId: "org_lead_test",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "outreach@roxx-crm.com",
      encryptedPassword: encryptSecret("validpassword123"),
      fromName: "Sarah Outreach",
      fromEmail: "outreach@roxx-crm.com",
      updatedAt: new Date().toISOString(),
    };

    // Seed test leads
    mockLeadsStore.push(
      {
        id: "lead_alpha",
        organizationId: "org_lead_test",
        leadNumber: "LEAD-0001",
        firstName: "Alice",
        lastName: "Alpha",
        fullName: "Alice Alpha",
        email: "alice@alpha-corp.com",
        companyName: "Alpha Corp",
        jobTitle: "VP Sales",
        source: "LinkedIn",
        status: "New",
        rating: "Hot",
        estimatedValue: 15000,
        currency: "USD",
        ownerName: "Sarah Sales",
        createdAt: new Date().toISOString(),
      },
      {
        id: "lead_beta",
        organizationId: "org_lead_test",
        leadNumber: "LEAD-0002",
        firstName: "Bob",
        lastName: "Beta",
        fullName: "Bob Beta",
        email: "bob@beta-tech.com",
        companyName: "Beta Tech",
        jobTitle: "CTO",
        source: "Outbound",
        status: "Contacted",
        rating: "Warm",
        estimatedValue: 8000,
        currency: "USD",
        ownerName: "Sarah Sales",
        createdAt: new Date().toISOString(),
      }
    );
  });

  it("should return NONE status and zero counts when no emails have been sent to a lead", async () => {
    const res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.success).toBe(true);
    expect(res.data?.overallStatus).toBe("NONE");
    expect(res.data?.totalSent).toBe(0);
    expect(res.data?.totalOpens).toBe(0);
    expect(res.data?.totalClicks).toBe(0);
    expect(res.data?.isBounced).toBe(false);
    expect(res.data?.isUnsubscribed).toBe(false);
    expect(res.data?.items).toHaveLength(0);
  });

  it("should track batch marketing campaign email status progression (DELIVERED -> OPENED -> CLICKED)", async () => {
    // 1. Seed batch campaign with Alice
    mockMarketingCampaignsStore.push({
      id: "camp_lead_test_1",
      batchId: "batch_1",
      organizationId: "org_lead_test",
      senderId: "usr_lead_rep",
      senderName: "Sarah Sales",
      senderEmail: "outreach@roxx-crm.com",
      subject: "Exclusive AI Workflow Demo",
      body: "Hi Alice, see our demo at https://roxx-crm.com/demo",
      status: "SENT",
      totalRecipients: 1,
      sentCount: 1,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      recipientLogs: [
        {
          leadId: "lead_alpha",
          leadName: "Alice Alpha",
          email: "alice@alpha-corp.com",
          companyName: "Alpha Corp",
          status: "SENT",
          sentAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Initial check: status should be DELIVERED
    let res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.success).toBe(true);
    expect(res.data?.overallStatus).toBe("DELIVERED");
    expect(res.data?.totalSent).toBe(1);
    expect(res.data?.totalOpens).toBe(0);
    expect(res.data?.totalClicks).toBe(0);
    expect(res.data?.items[0].status).toBe("DELIVERED");
    expect(res.data?.items[0].source).toBe("BATCH_CAMPAIGN");

    // 2. Lead opens email
    await recordEmailOpen("camp_lead_test_1", "lead_alpha");

    res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.data?.overallStatus).toBe("OPENED");
    expect(res.data?.totalOpens).toBe(1);
    expect(res.data?.items[0].status).toBe("OPENED");
    expect(res.data?.items[0].openCount).toBe(1);
    expect(res.data?.items[0].openedAt).toBeDefined();

    // 3. Lead clicks link
    await recordEmailClick(
      "camp_lead_test_1",
      "lead_alpha",
      "https://roxx-crm.com/demo"
    );

    res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.data?.overallStatus).toBe("CLICKED");
    expect(res.data?.totalClicks).toBe(1);
    expect(res.data?.items[0].status).toBe("CLICKED");
    expect(res.data?.items[0].clickCount).toBe(1);
    expect(res.data?.items[0].lastClickedUrl).toBe("https://roxx-crm.com/demo");
  });

  it("should track batch marketing bounce and unsubscribe states accurately", async () => {
    mockMarketingCampaignsStore.push({
      id: "camp_bounce_test",
      batchId: "batch_2",
      organizationId: "org_lead_test",
      senderId: "usr_lead_rep",
      senderName: "Sarah Sales",
      senderEmail: "outreach@roxx-crm.com",
      subject: "Product Launch",
      body: "Check this out",
      status: "SENT",
      totalRecipients: 1,
      sentCount: 1,
      failedCount: 0,
      recipientLogs: [
        {
          leadId: "lead_beta",
          leadName: "Bob Beta",
          email: "bob@beta-tech.com",
          companyName: "Beta Tech",
          status: "SENT",
          sentAt: new Date().toISOString(),
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Record bounce
    await recordEmailBounce(
      "camp_bounce_test",
      "lead_beta",
      "bob@beta-tech.com",
      "550 5.1.1 Mailbox does not exist"
    );

    let res = await getLeadEmailEngagementAction("lead_beta");
    expect(res.data?.overallStatus).toBe("BOUNCED");
    expect(res.data?.isBounced).toBe(true);
    expect(res.data?.bounceReason).toContain("550");
    expect(res.data?.items[0].status).toBe("BOUNCED");

    // Unsubscribe another lead
    await recordEmailUnsubscribe(
      "camp_bounce_test",
      "lead_alpha",
      "alice@alpha-corp.com"
    );

    res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.data?.overallStatus).toBe("UNSUBSCRIBED");
    expect(res.data?.isUnsubscribed).toBe(true);
  });

  it("should track 1-on-1 direct outbound email sent via sendEmailAction", async () => {
    // Send a 1-on-1 email to Alice
    const sendResult = await sendEmailAction({
      to: "alice@alpha-corp.com",
      subject: "Direct Catch-up Meeting",
      body: "Hi {{firstName}}, are you free tomorrow? View link: https://roxx-crm.com/calendar",
      entityId: "lead_alpha",
      entityType: "lead",
    });

    expect(sendResult.success).toBe(true);
    expect(mockDirectEmailsStore).toHaveLength(1);
    expect(mockDirectEmailsStore[0].status).toBe("DELIVERED");
    expect(mockDirectEmailsStore[0].leadId).toBe("lead_alpha");

    // Retrieve engagement
    let res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.success).toBe(true);
    expect(res.data?.overallStatus).toBe("DELIVERED");
    expect(res.data?.totalSent).toBe(1);
    expect(res.data?.items[0].source).toBe("DIRECT_EMAIL");
    expect(res.data?.items[0].subject).toBe("Direct Catch-up Meeting");

    const dispatchId = mockDirectEmailsStore[0].id;

    // Simulate open tracking on the 1-on-1 email
    await recordEmailOpen(dispatchId, "lead_alpha");

    res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.data?.overallStatus).toBe("OPENED");
    expect(res.data?.totalOpens).toBe(1);
    expect(res.data?.items[0].status).toBe("OPENED");
    expect(res.data?.items[0].openCount).toBe(1);

    // Simulate click tracking on the 1-on-1 email
    await recordEmailClick(
      dispatchId,
      "lead_alpha",
      "https://roxx-crm.com/calendar"
    );

    res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.data?.overallStatus).toBe("CLICKED");
    expect(res.data?.totalClicks).toBe(1);
    expect(res.data?.items[0].status).toBe("CLICKED");
    expect(res.data?.items[0].lastClickedUrl).toBe("https://roxx-crm.com/calendar");
  });

  it("should aggregate multiple dispatches (batch + 1-on-1) sorted by newest first", async () => {
    // 1. Send batch campaign
    mockMarketingCampaignsStore.push({
      id: "camp_multi_1",
      batchId: "b1",
      organizationId: "org_lead_test",
      senderId: "usr_lead_rep",
      senderName: "Marketing Bot",
      senderEmail: "outreach@roxx-crm.com",
      subject: "Newsletter #1",
      body: "News content",
      status: "SENT",
      totalRecipients: 1,
      sentCount: 1,
      failedCount: 0,
      recipientLogs: [
        {
          leadId: "lead_alpha",
          leadName: "Alice Alpha",
          email: "alice@alpha-corp.com",
          status: "OPENED",
          sentAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
          openedAt: new Date(Date.now() - 3500000).toISOString(),
          openCount: 2,
        },
      ],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      updatedAt: new Date(Date.now() - 3600000).toISOString(),
    });

    // 2. Send 1-on-1 email directly
    await sendEmailAction({
      to: "alice@alpha-corp.com",
      subject: "Follow-up proposal",
      body: "Hi Alice, attached proposal",
      entityId: "lead_alpha",
      entityType: "lead",
    });

    const res = await getLeadEmailEngagementAction("lead_alpha");
    expect(res.success).toBe(true);
    expect(res.data?.totalSent).toBe(2);
    expect(res.data?.items).toHaveLength(2);
    // Newest email (Follow-up proposal) should be first
    expect(res.data?.items[0].subject).toBe("Follow-up proposal");
    expect(res.data?.items[1].subject).toBe("Newsletter #1");
    // Overall status reflects open from the campaign
    expect(res.data?.overallStatus).toBe("OPENED");
    expect(res.data?.totalOpens).toBe(2);
  });

  it("should auto-seed initial outreach when lead emailStatus is 'Sent' and no outbound logs exist", async () => {
    // Add a lead that has emailStatus = "Sent"
    mockLeadsStore.push({
      id: "lead_sent_client",
      organizationId: "org_lead_test",
      leadNumber: "LEAD-0003",
      firstName: "David",
      lastName: "Delivered",
      fullName: "David Delivered",
      email: "david@client.com",
      companyName: "Delivered Corp",
      status: "Contacted",
      emailStatus: "Sent",
      createdAt: new Date().toISOString(),
    } as any);

    const res = await getLeadEmailEngagementAction("lead_sent_client");
    expect(res.success).toBe(true);
    expect(res.data?.totalSent).toBe(1);
    expect(res.data?.overallStatus).toBe("DELIVERED");
    expect(res.data?.items).toHaveLength(1);
    expect(res.data?.items[0].subject).toBe("Initial Sales Outreach");
    expect(res.data?.items[0].status).toBe("DELIVERED");
    expect(res.data?.items[0].source).toBe("DIRECT_EMAIL");
  });

  it("should support simulateLeadEmailEngagementAction to test OPEN, CLICK, BOUNCE, and RESET", async () => {
    // 1. Dispatch a test tracked email
    const sendRes = await sendTestTrackedEmailAction({
      leadId: "lead_alpha",
      subject: "Interactive Product Showcase",
      body: "Check out our portal",
      toEmail: "alice@alpha-corp.com",
    });

    expect(sendRes.success).toBe(true);
    expect(sendRes.dispatchId).toBeDefined();
    const dispatchId = sendRes.dispatchId!;

    let engagement = await getLeadEmailEngagementAction("lead_alpha");
    expect(engagement.data?.overallStatus).toBe("DELIVERED");
    expect(engagement.data?.totalSent).toBe(1);

    // 2. Simulate OPEN
    const openRes = await simulateLeadEmailEngagementAction({
      leadId: "lead_alpha",
      dispatchId,
      event: "OPEN",
    });
    expect(openRes.success).toBe(true);

    engagement = await getLeadEmailEngagementAction("lead_alpha");
    expect(engagement.data?.overallStatus).toBe("OPENED");
    expect(engagement.data?.totalOpens).toBe(1);
    expect(engagement.data?.items[0].status).toBe("OPENED");

    // 3. Simulate CLICK
    const clickRes = await simulateLeadEmailEngagementAction({
      leadId: "lead_alpha",
      dispatchId,
      event: "CLICK",
      targetUrl: "https://roxx-crm.com/live-demo",
    });
    expect(clickRes.success).toBe(true);

    engagement = await getLeadEmailEngagementAction("lead_alpha");
    expect(engagement.data?.overallStatus).toBe("CLICKED");
    expect(engagement.data?.totalClicks).toBe(1);
    expect(engagement.data?.items[0].status).toBe("CLICKED");
    expect(engagement.data?.items[0].lastClickedUrl).toBe("https://roxx-crm.com/live-demo");

    // 4. Simulate BOUNCE
    const bounceRes = await simulateLeadEmailEngagementAction({
      leadId: "lead_alpha",
      dispatchId,
      event: "BOUNCED",
      bounceReason: "550 5.1.1 Mailbox does not exist",
    });
    expect(bounceRes.success).toBe(true);

    engagement = await getLeadEmailEngagementAction("lead_alpha");
    expect(engagement.data?.overallStatus).toBe("BOUNCED");
    expect(engagement.data?.isBounced).toBe(true);
    expect(engagement.data?.items[0].status).toBe("BOUNCED");

    // 5. Simulate RESET
    const resetRes = await simulateLeadEmailEngagementAction({
      leadId: "lead_alpha",
      dispatchId,
      event: "RESET",
    });
    expect(resetRes.success).toBe(true);

    engagement = await getLeadEmailEngagementAction("lead_alpha");
    expect(engagement.data?.overallStatus).toBe("DELIVERED");
    expect(engagement.data?.isBounced).toBe(false);
    expect(engagement.data?.totalOpens).toBe(0);
    expect(engagement.data?.totalClicks).toBe(0);
  });

  it("should automatically include email activities logged via mail client into the Outbound Email Log", async () => {
    // Simulate user sending via mail client, which logs an activity
    mockActivitiesStore.push({
      id: "act_mail_client_1",
      organizationId: "org_lead_test",
      type: "EMAIL",
      subject: "Regarding our discussion — Roxx CRM",
      description: "To: bob@beta-tech.com\n\nHi Bob, great speaking with you today.",
      leadId: "lead_beta",
      leadName: "Bob Beta",
      companyId: null,
      companyName: null,
      contactId: null,
      contactName: null,
      opportunityId: null,
      opportunityName: null,
      userId: "usr_lead_rep",
      userName: "Sarah Sales",
      activityAt: new Date().toISOString(),
      durationMinutes: null,
      outcome: "SENT",
      createdAt: new Date().toISOString(),
    });

    const res = await getLeadEmailEngagementAction("lead_beta");
    expect(res.success).toBe(true);
    expect(res.data?.totalSent).toBe(1);
    expect(res.data?.items[0].subject).toBe("Regarding our discussion — Roxx CRM");
    expect(res.data?.items[0].source).toBe("DIRECT_EMAIL");
    expect(res.data?.items[0].status).toBe("DELIVERED");
  });
});
