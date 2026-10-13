import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockLeadsStore,
  mockActivitiesStore,
  mockSuppressedEmailsStore,
  mockSmtpStore,
} from "@/lib/db/mock-store";
import { encryptSecret } from "@/lib/crypto/encryption";
import {
  injectTrackingIntoHtml,
  isValidHttpUrl,
  isEmailSuppressed,
  suppressEmail,
  recordEmailOpen,
  recordEmailClick,
  recordEmailBounce,
  recordEmailUnsubscribe,
  calculateCampaignKpis,
} from "@/lib/email/tracking";
import { GET as getOpenRoute } from "@/app/api/v1/email/track/open/route";
import { GET as getClickRoute } from "@/app/api/v1/email/track/click/route";
import {
  GET as getUnsubRoute,
  POST as postUnsubRoute,
} from "@/app/api/v1/email/unsubscribe/route";
import { POST as postBounceRoute } from "@/app/api/v1/email/bounce/route";
import { NextRequest } from "next/server";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock auth session
let mockSessionUser: any = {
  id: "usr_marketing_rep",
  organizationId: "org_tracking_test",
  organizationName: "Tracking Test Org",
  email: "alex@roxx-crm.com",
  name: "Alex Marketing",
  role: "SALES_REP",
  permissions: ["activity:create", "lead:create"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  getSession: vi.fn(async () => mockSessionUser),
}));

// Mock mailer
vi.mock("@/lib/email/mailer", () => ({
  sendSmtpEmail: vi.fn(async (_conn, opts) => {
    if (opts.to === "bounce@example.com") {
      return {
        success: false,
        isBounce: true,
        bounceReason: "550 5.1.1 User unknown / mailbox unavailable",
        error: "550 5.1.1 User unknown / mailbox unavailable",
      };
    }
    if (opts.to === "fail@example.com") {
      return {
        success: false,
        error: "Temporary network timeout",
      };
    }
    return { success: true, messageId: `msg_${Date.now()}` };
  }),
}));

import { sendBatchEmailAction } from "@/actions/marketing";

describe("Email Engagement Tracking & Batch Performance Analytics", () => {
  beforeEach(() => {
    mockMarketingBatchesStore.length = 0;
    mockMarketingCampaignsStore.length = 0;
    mockLeadsStore.length = 0;
    mockActivitiesStore.length = 0;
    mockSuppressedEmailsStore.clear();

    mockSmtpStore["org_tracking_test"] = {
      organizationId: "org_tracking_test",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "smtp@roxx-crm.com",
      encryptedPassword: encryptSecret("supersecretpass"),
      fromName: "Marketing Team",
      fromEmail: "sales@roxx-crm.com",
      updatedAt: new Date().toISOString(),
    };

    // Seed test leads
    mockLeadsStore.push(
      {
        id: "lead_track_1",
        organizationId: "org_tracking_test",
        leadNumber: "LEAD-001",
        firstName: "Sarah",
        lastName: "Connor",
        fullName: "Sarah Connor",
        email: "sarah@cyberdyne.io",
        supportEmail: null,
        phone: "+1 555-0199",
        companyName: "Cyberdyne Systems",
        jobTitle: "Operations Lead",
        source: "Website",
        status: "New",
        rating: "Hot",
        estimatedValue: 50000,
        currency: "USD",
        ownerId: "usr_marketing_rep",
        ownerName: "Alex Marketing",
        assignedAt: new Date().toISOString(),
        expectedCloseDate: null,
        description: null,
        createdById: "usr_marketing_rep",
        convertedAt: null,
        convertedCompanyId: null,
        convertedContactId: null,
        convertedOpportunityId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      },
      {
        id: "lead_track_2",
        organizationId: "org_tracking_test",
        leadNumber: "LEAD-002",
        firstName: "John",
        lastName: "Doe",
        fullName: "John Doe",
        email: "bounce@example.com",
        supportEmail: null,
        phone: "+1 555-0200",
        companyName: "Acme Corp",
        jobTitle: "CTO",
        source: "Outreach",
        status: "New",
        rating: "Warm",
        estimatedValue: 25000,
        currency: "USD",
        ownerId: "usr_marketing_rep",
        ownerName: "Alex Marketing",
        assignedAt: new Date().toISOString(),
        expectedCloseDate: null,
        description: null,
        createdById: "usr_marketing_rep",
        convertedAt: null,
        convertedCompanyId: null,
        convertedContactId: null,
        convertedOpportunityId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      }
    );
  });

  describe("1. Tracking Injection & URL Helpers", () => {
    it("validates safe HTTP/HTTPS destination URLs", () => {
      expect(isValidHttpUrl("https://techflux.in/book-demo")).toBe(true);
      expect(isValidHttpUrl("http://localhost:3000/pricing")).toBe(true);
      expect(isValidHttpUrl("javascript:alert(1)")).toBe(false);
      expect(isValidHttpUrl("data:text/html,bad")).toBe(false);
      expect(isValidHttpUrl("invalid-url")).toBe(false);
    });

    it("injects 1x1 tracking pixel and rewrites web links to click proxy", () => {
      const html = `<p>Hi Sarah,</p><p>Check out our <a href="https://techflux.in/portfolio">case studies</a> or email us at <a href="mailto:sales@techflux.in">contact</a>.</p>`;
      const tracked = injectTrackingIntoHtml(html, {
        campaignId: "camp_123",
        leadId: "lead_track_1",
        recipientEmail: "sarah@cyberdyne.io",
        baseUrl: "https://crm.roxx.com",
        isMarketing: true,
      });

      // Contains open tracking pixel
      expect(tracked).toContain("/api/v1/email/track/open?cid=camp_123&lid=lead_track_1");
      expect(tracked).toContain('<img src="https://crm.roxx.com/api/v1/email/track/open?cid=camp_123&lid=lead_track_1"');

      // Click link rewritten
      expect(tracked).toContain("/api/v1/email/track/click?cid=camp_123&lid=lead_track_1&url=https%3A%2F%2Ftechflux.in%2Fportfolio");

      // Mailto link preserved as-is
      expect(tracked).toContain('href="mailto:sales@techflux.in"');

      // Unsubscribe footer injected
      expect(tracked).toContain("/api/v1/email/unsubscribe?cid=camp_123&lid=lead_track_1&email=sarah%40cyberdyne.io");
    });
  });

  describe("2. Open Tracking & Promotion", () => {
    it("records first open, updates recipient log status, increments count, and logs activity", async () => {
      // Seed campaign
      mockMarketingCampaignsStore.push({
        id: "camp_open_test",
        batchId: "batch_1",
        organizationId: "org_tracking_test",
        senderId: "usr_marketing_rep",
        senderName: "Alex Marketing",
        senderEmail: "alex@roxx-crm.com",
        subject: "Introduction to Techflux",
        body: "Hello Sarah...",
        status: "SENT",
        totalRecipients: 1,
        sentCount: 1,
        failedCount: 0,
        recipientLogs: [
          {
            leadId: "lead_track_1",
            leadName: "Sarah Connor",
            email: "sarah@cyberdyne.io",
            status: "SENT",
            sentAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const res = await recordEmailOpen("camp_open_test", "lead_track_1");
      expect(res.success).toBe(true);
      expect(res.isFirstOpen).toBe(true);

      const camp = mockMarketingCampaignsStore[0];
      const log = camp.recipientLogs[0];
      expect(log.status).toBe("OPENED");
      expect(log.openCount).toBe(1);
      expect(log.openedAt).toBeDefined();
      expect(camp.openedCount).toBe(1);

      // Verify activity recorded
      const activity = mockActivitiesStore.find(
        (a) => a.leadId === "lead_track_1" && a.subject.includes("Email Opened")
      );
      expect(activity).toBeDefined();
    });
  });

  describe("3. Click Tracking & CTR Attribution", () => {
    it("records click, increments clickCount, promotes status to CLICKED, and records openedAt", async () => {
      mockMarketingCampaignsStore.push({
        id: "camp_click_test",
        batchId: "batch_1",
        organizationId: "org_tracking_test",
        senderId: "usr_marketing_rep",
        senderName: "Alex Marketing",
        senderEmail: "alex@roxx-crm.com",
        subject: "Follow Up",
        body: "Check out link",
        status: "SENT",
        totalRecipients: 1,
        sentCount: 1,
        failedCount: 0,
        recipientLogs: [
          {
            leadId: "lead_track_1",
            leadName: "Sarah Connor",
            email: "sarah@cyberdyne.io",
            status: "SENT",
            sentAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const targetUrl = "https://techflux.in/book-meeting";
      const res = await recordEmailClick("camp_click_test", "lead_track_1", targetUrl);
      expect(res.success).toBe(true);
      expect(res.isFirstClick).toBe(true);

      const log = mockMarketingCampaignsStore[0].recipientLogs[0];
      expect(log.status).toBe("CLICKED");
      expect(log.clickCount).toBe(1);
      expect(log.lastClickedUrl).toBe(targetUrl);
      expect(log.openedAt).toBeDefined();

      const camp = mockMarketingCampaignsStore[0];
      expect(camp.clickedCount).toBe(1);
      expect(camp.openedCount).toBe(1);
    });
  });

  describe("4. Bounce Detection & Suppression", () => {
    it("records bounce, suppresses email address, and updates campaign bounce count", async () => {
      mockMarketingCampaignsStore.push({
        id: "camp_bounce_test",
        batchId: "batch_1",
        organizationId: "org_tracking_test",
        senderId: "usr_marketing_rep",
        senderName: "Alex Marketing",
        senderEmail: "alex@roxx-crm.com",
        subject: "Outreach",
        body: "Hello",
        status: "SENT",
        totalRecipients: 1,
        sentCount: 1,
        failedCount: 0,
        recipientLogs: [
          {
            leadId: "lead_track_2",
            leadName: "John Doe",
            email: "bounce@example.com",
            status: "SENT",
            sentAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await recordEmailBounce(
        "camp_bounce_test",
        "lead_track_2",
        "bounce@example.com",
        "550 Mailbox does not exist"
      );

      const log = mockMarketingCampaignsStore[0].recipientLogs[0];
      expect(log.status).toBe("BOUNCED");
      expect(log.bounceReason).toBe("550 Mailbox does not exist");
      expect(mockMarketingCampaignsStore[0].bouncedCount).toBe(1);

      // Verify email is in suppression list
      expect(isEmailSuppressed("bounce@example.com")).toBe(true);
      expect(isEmailSuppressed("BOUNCE@EXAMPLE.COM")).toBe(true);
    });
  });

  describe("5. Unsubscribe & Suppression", () => {
    it("unsubscribes recipient, updates lead status, suppresses email, and records unsubscription", async () => {
      mockMarketingCampaignsStore.push({
        id: "camp_unsub_test",
        batchId: "batch_1",
        organizationId: "org_tracking_test",
        senderId: "usr_marketing_rep",
        senderName: "Alex Marketing",
        senderEmail: "alex@roxx-crm.com",
        subject: "Marketing Update",
        body: "Hello",
        status: "SENT",
        totalRecipients: 1,
        sentCount: 1,
        failedCount: 0,
        recipientLogs: [
          {
            leadId: "lead_track_1",
            leadName: "Sarah Connor",
            email: "sarah@cyberdyne.io",
            status: "SENT",
            sentAt: new Date().toISOString(),
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await recordEmailUnsubscribe("camp_unsub_test", "lead_track_1", "sarah@cyberdyne.io");

      const log = mockMarketingCampaignsStore[0].recipientLogs[0];
      expect(log.status).toBe("UNSUBSCRIBED");
      expect(log.unsubscribedAt).toBeDefined();
      expect(mockMarketingCampaignsStore[0].unsubscribedCount).toBe(1);

      // Verify CRM lead updated
      const lead = mockLeadsStore.find((l) => l.id === "lead_track_1");
      expect(lead?.status).toBe("Unsubscribed");

      // Verify email suppression
      expect(isEmailSuppressed("sarah@cyberdyne.io")).toBe(true);
    });
  });

  describe("6. KPI Aggregate Calculations", () => {
    it("computes accurate open, CTR, bounce, and unsub rates", () => {
      const logs = [
        { status: "OPENED", openedAt: "2026-10-13T09:00:00Z" },
        { status: "CLICKED", openedAt: "2026-10-13T09:00:00Z", clickedAt: "2026-10-13T09:01:00Z" },
        { status: "SENT" },
        { status: "BOUNCED", bouncedAt: "2026-10-13T09:00:00Z" },
        { status: "UNSUBSCRIBED", unsubscribedAt: "2026-10-13T09:00:00Z" },
      ];

      const kpis = calculateCampaignKpis(logs);
      expect(kpis.total).toBe(5);
      expect(kpis.sentCount).toBe(5);
      expect(kpis.openedCount).toBe(2);
      expect(kpis.clickedCount).toBe(1);
      expect(kpis.bouncedCount).toBe(1);
      expect(kpis.unsubscribedCount).toBe(1);

      expect(kpis.openRate).toBe(40.0);
      expect(kpis.clickThroughRate).toBe(20.0);
      expect(kpis.bounceRate).toBe(20.0);
      expect(kpis.unsubscribeRate).toBe(20.0);
    });
  });

  describe("7. Public Tracking Endpoints", () => {
    it("GET /api/v1/email/track/open returns 1x1 image/gif and records open", async () => {
      mockMarketingCampaignsStore.push({
        id: "camp_api_open",
        batchId: "batch_1",
        organizationId: "org_tracking_test",
        senderId: "usr_marketing_rep",
        senderName: "Alex Marketing",
        senderEmail: "alex@roxx-crm.com",
        subject: "Hello",
        body: "Hello",
        status: "SENT",
        totalRecipients: 1,
        sentCount: 1,
        failedCount: 0,
        recipientLogs: [
          {
            leadId: "lead_track_1",
            leadName: "Sarah Connor",
            email: "sarah@cyberdyne.io",
            status: "SENT",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const req = new NextRequest(
        "http://localhost:3000/api/v1/email/track/open?cid=camp_api_open&lid=lead_track_1"
      );
      const res = await getOpenRoute(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/gif");
      expect(res.headers.get("Cache-Control")).toContain("no-store");

      const log = mockMarketingCampaignsStore[0].recipientLogs[0];
      expect(log.status).toBe("OPENED");
    });

    it("GET /api/v1/email/track/click redirects safely and records click", async () => {
      mockMarketingCampaignsStore.push({
        id: "camp_api_click",
        batchId: "batch_1",
        organizationId: "org_tracking_test",
        senderId: "usr_marketing_rep",
        senderName: "Alex Marketing",
        senderEmail: "alex@roxx-crm.com",
        subject: "Hello",
        body: "Hello",
        status: "SENT",
        totalRecipients: 1,
        sentCount: 1,
        failedCount: 0,
        recipientLogs: [
          {
            leadId: "lead_track_1",
            leadName: "Sarah Connor",
            email: "sarah@cyberdyne.io",
            status: "SENT",
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const dest = "https://techflux.in/meeting";
      const req = new NextRequest(
        `http://localhost:3000/api/v1/email/track/click?cid=camp_api_click&lid=lead_track_1&url=${encodeURIComponent(
          dest
        )}`
      );
      const res = await getClickRoute(req);

      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(dest);

      const log = mockMarketingCampaignsStore[0].recipientLogs[0];
      expect(log.status).toBe("CLICKED");
      expect(log.lastClickedUrl).toBe(dest);
    });

    it("GET & POST /api/v1/email/unsubscribe handles unsubscriptions", async () => {
      // POST RFC 8058 One-Click
      const postReq = new NextRequest(
        "http://localhost:3000/api/v1/email/unsubscribe?cid=camp_1&lid=lead_track_1&email=sarah@cyberdyne.io",
        { method: "POST" }
      );
      const postRes = await postUnsubRoute(postReq);
      expect(postRes.status).toBe(200);
      const json = await postRes.json();
      expect(json.success).toBe(true);

      // GET browser confirmation
      const getReq = new NextRequest(
        "http://localhost:3000/api/v1/email/unsubscribe?cid=camp_1&lid=lead_track_1&email=sarah@cyberdyne.io"
      );
      const getRes = await getUnsubRoute(getReq);
      expect(getRes.status).toBe(200);
      const html = await getRes.text();
      expect(html).toContain("You have been unsubscribed");
      expect(html).toContain("sarah@cyberdyne.io");
    });

    it("POST /api/v1/email/bounce records asynchronous bounce payload", async () => {
      const postReq = new NextRequest("http://localhost:3000/api/v1/email/bounce", {
        method: "POST",
        body: JSON.stringify({
          campaignId: "camp_async",
          leadId: "lead_track_1",
          email: "sarah@cyberdyne.io",
          reason: "554 5.7.1 Recipient address rejected",
        }),
      });
      const res = await postBounceRoute(postReq);
      expect(res.status).toBe(200);
      expect(isEmailSuppressed("sarah@cyberdyne.io")).toBe(true);
    });
  });

  describe("8. sendBatchEmailAction with Suppression & Bounce Detection", () => {
    it("dispatches batch email, skips suppressed leads, and captures SMTP bounces", async () => {
      // Pre-suppress Sarah
      suppressEmail("sarah@cyberdyne.io");

      // Seed marketing batch
      mockMarketingBatchesStore.push({
        id: "batch_full_flow",
        organizationId: "org_tracking_test",
        name: "Spring Q2 Campaign",
        ownerId: "usr_marketing_rep",
        ownerName: "Alex Marketing",
        leadIds: ["lead_track_1", "lead_track_2"],
        leadCount: 2,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await sendBatchEmailAction({
        batchId: "batch_full_flow",
        subject: "Special Q2 Opportunity",
        body: "Hello {{firstName}} from {{companyName}}!",
      });

      expect(result.success).toBe(true);
      const camp = result.data!;

      // Sarah should be skipped due to suppression
      const sarahLog = camp.recipientLogs.find((l) => l.leadId === "lead_track_1");
      expect(sarahLog?.status).toBe("SKIPPED");
      expect(sarahLog?.error).toContain("unsubscribed or suppressed");

      // John (bounce@example.com) should be marked as BOUNCED
      const johnLog = camp.recipientLogs.find((l) => l.leadId === "lead_track_2");
      expect(johnLog?.status).toBe("BOUNCED");
      expect(johnLog?.bounceReason).toContain("550 5.1.1");
      expect(isEmailSuppressed("bounce@example.com")).toBe(true);
    });
  });
});
