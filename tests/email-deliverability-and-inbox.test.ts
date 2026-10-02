import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nodemailer from "nodemailer";
import * as imapModule from "@/lib/email/imap-client";
import {
  parseEmailAddress,
  decodeMimeHeader,
  decodeQuotedPrintable,
  cleanMimeBody,
} from "@/lib/email/imap-client";
import * as mailerModule from "@/lib/email/mailer";
import * as sessionModule from "@/lib/auth/session";
import {
  checkDomainDeliverabilityAction,
  saveImapConfigAction,
  getImapConfigAction,
} from "@/actions/email";
import {
  getInboxEmailsAction,
  getInboxAccountStatusAction,
  markEmailAsReadAction,
  syncInboxAction,
  replyToClientAction,
  deleteInboxEmailAction,
} from "@/actions/inbox";
import {
  mockImapStore,
  mockSmtpStore,
  mockInboxStore,
  mockLeadsStore,
  mockActivitiesStore,
} from "@/lib/db/mock-store";
import { encryptSecret, decryptSecret } from "@/lib/crypto/encryption";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(sessionModule, "getSession").mockResolvedValue({
    id: "usr_admin",
    organizationId: "demo-org-123",
    organizationName: "Demo Company",
    email: "admin@roxx-crm.local",
    name: "Admin User",
    role: "ADMIN",
    permissions: ["settings:update"],
    expiresAt: Date.now() + 3600000,
  });
});

describe("Email Deliverability & Spam Prevention", () => {
  it("generates correct SPF, DKIM, DMARC DNS recommendations for an organization", async () => {
    // Setup SMTP store for demo org
    mockSmtpStore["demo-org-123"] = {
      organizationId: "demo-org-123",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "sales@acmeenterprise.com",
      encryptedPassword: encryptSecret("mock-app-password"),
      fromName: "Acme Sales",
      fromEmail: "sales@acmeenterprise.com",
      updatedAt: new Date().toISOString(),
    };

    const res = await checkDomainDeliverabilityAction();
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();

    if (res.data) {
      expect(res.data.domain).toBe("acmeenterprise.com");
      expect(res.data.alignmentStatus).toBe("aligned");
      expect(res.data.spf.record).toContain("include:_spf.google.com");
      expect(res.data.dmarc.record).toContain("v=DMARC1");
      expect(res.data.score).toBeGreaterThanOrEqual(80);
      expect(res.data.recommendations.length).toBeGreaterThan(0);
    }
  });

  it("flags sender alignment mismatch when From Email domain differs from SMTP username", async () => {
    mockSmtpStore["demo-org-123"] = {
      organizationId: "demo-org-123",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "internal-login@company-infra.net",
      encryptedPassword: encryptSecret("mock-app-password"),
      fromName: "Acme Sales",
      fromEmail: "sales@brandstore.com",
      updatedAt: new Date().toISOString(),
    };

    const res = await checkDomainDeliverabilityAction();
    expect(res.success).toBe(true);
    expect(res.data?.alignmentStatus).toBe("mismatched");
    expect(res.data?.alignmentDetails).toContain("Warning: From address domain");
    expect(res.data?.score).toBeLessThan(80);
  });

  it("optimizes deliverability for personal @gmail.com accounts with auto-managed authentication", async () => {
    mockSmtpStore["demo-org-123"] = {
      organizationId: "demo-org-123",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "infotflux@gmail.com",
      encryptedPassword: encryptSecret("mock-app-password"),
      fromName: "Techflux Support",
      fromEmail: "infotflux@gmail.com",
      updatedAt: new Date().toISOString(),
    };

    const res = await checkDomainDeliverabilityAction();
    expect(res.success).toBe(true);
    expect(res.data).toBeDefined();

    if (res.data) {
      expect(res.data.isGmailSender).toBe(true);
      expect(res.data.humanDeliveryMode).toBe(true);
      expect(res.data.alignmentStatus).toBe("aligned");
      expect(res.data.spf.instructions).toContain("Google automatically authenticates SPF");
      expect(res.data.dkim.instructions).toContain("Google automatically attaches its verified DKIM-Signature");
      expect(res.data.score).toBe(100);

      // Verify recommendations highlight anti-bot and human delivery modes
      const recs = res.data.recommendations.join(" ");
      expect(recs).toContain("Direct 1-on-1 Human Delivery Mode is ACTIVE");
      expect(recs).toContain("Native Message-ID alignment is ACTIVE");
      expect(recs).toContain("X-Mailer header is REMOVED");
    }
  });

  it("dispatches outbound emails using human 1-on-1 formatting, without X-Mailer or synthetic Message-IDs", async () => {
    const sendMailMock = vi.fn().mockResolvedValue({
      messageId: "<google-canonical-id@mail.gmail.com>",
    });

    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: sendMailMock,
    } as any);

    const result = await mailerModule.sendSmtpEmail(
      {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "infotflux@gmail.com",
        password: "mock-password",
      },
      {
        to: "client@example.com",
        subject: "Following up on our conversation",
        body: "Hi Alex,\n\nFollowing up on our call earlier today.\n\nBest,\nTechflux Team",
        fromName: "Techflux Support",
        fromEmail: "infotflux@gmail.com",
      }
    );

    expect(result.success).toBe(true);
    expect(result.messageId).toBe("<google-canonical-id@mail.gmail.com>");
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const mailOptions = sendMailMock.mock.calls[0][0];

    // 1. Natural 1-on-1 human HTML without marketing containers or doctype
    expect(mailOptions.html).toContain('dir="ltr"');
    expect(mailOptions.html).not.toContain("max-width: 600px");
    expect(mailOptions.html).not.toContain("<!DOCTYPE html>");

    // 2. Anti-bot shield: X-Mailer must NOT exist
    expect(mailOptions.headers?.["X-Mailer"]).toBeUndefined();

    // 3. Native Message-ID: client must NOT inject a synthetic messageId
    expect(mailOptions.messageId).toBeUndefined();

    // 4. Sender envelope alignment
    expect(mailOptions.envelope).toEqual({
      from: "infotflux@gmail.com",
      to: "client@example.com",
    });
  });
});

describe("IMAP Client & Incoming Mail Configuration", () => {
  it("parses raw email headers accurately into name and email", () => {
    const formatted = parseEmailAddress('"Elena Rostova" <elena.rostova@cyberdynesys.local>');
    expect(formatted.name).toBe("Elena Rostova");
    expect(formatted.email).toBe("elena.rostova@cyberdynesys.local");

    const simple = parseEmailAddress("support@domain.com");
    expect(simple.name).toBe("support");
    expect(simple.email).toBe("support@domain.com");

    const plainBrackets = parseEmailAddress("<info@techflux.org>");
    expect(plainBrackets.email).toBe("info@techflux.org");
  });

  it("saves and retrieves encrypted IMAP credentials", async () => {
    const saveRes = await saveImapConfigAction({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      username: "sales@acmeenterprise.com",
      password: "my-secret-imap-password",
      useSmtpCredentials: false,
    });

    expect(saveRes.success).toBe(true);

    const getRes = await getImapConfigAction();
    expect(getRes.success).toBe(true);
    expect(getRes.data).toBeDefined();
    expect(getRes.data?.host).toBe("imap.gmail.com");
    expect(getRes.data?.port).toBe(993);
    expect(getRes.data?.secure).toBe(true);
    expect(getRes.data?.username).toBe("sales@acmeenterprise.com");
    expect(getRes.data?.hasPassword).toBe(true);
    expect(getRes.data?.maskedPassword).toBe("••••••••••••");
    // Ensure plaintext password is NOT leaked in display output
    expect((getRes.data as Record<string, unknown>).password).toBeUndefined();

    // Verify AES-256 storage
    const stored = mockImapStore["demo-org-123"];
    expect(stored).toBeDefined();
    expect(stored.encryptedPassword).not.toBe("my-secret-imap-password");
    expect(decryptSecret(stored.encryptedPassword!)).toBe("my-secret-imap-password");
  });
});

describe("CRM Inbox Actions & Lead Reply Synchronization", () => {
  beforeEach(() => {
    mockInboxStore.length = 0;
    mockInboxStore.push(
      {
        id: "test_msg_1",
        organizationId: "demo-org-123",
        messageId: "<reply-1001@customer.com>",
        fromEmail: "elena.customer@customer.com",
        fromName: "Elena Customer",
        toEmail: "infotflux@gmail.com",
        subject: "Re: Enterprise Contract Pricing & Proposal Terms",
        snippet: "Hi Alex, thanks for the contract yesterday...",
        bodyText: "Hi Alex,\n\nThanks for the contract yesterday.",
        date: new Date().toISOString(),
        isRead: false,
        leadId: "lead_1",
        leadName: "Elena Customer",
        createdAt: new Date().toISOString(),
      },
      {
        id: "test_msg_2",
        organizationId: "demo-org-123",
        messageId: "<inquiry-1002@buyer.com>",
        fromEmail: "marcus@buyer.com",
        fromName: "Marcus Buyer",
        toEmail: "infotflux@gmail.com",
        subject: "Follow up regarding SOC2 Compliance and Review",
        snippet: "Hello, our compliance team completed the review...",
        bodyText: "Hello, our compliance team completed the review.",
        date: new Date(Date.now() - 3600000).toISOString(),
        isRead: true,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      }
    );
  });

  it("lists organization emails and filters correctly", async () => {
    const listRes = await getInboxEmailsAction({ filter: "all" });
    expect(listRes.success).toBe(true);
    expect(listRes.data.length).toBeGreaterThan(0);

    // Test filter 'replies'
    const replyRes = await getInboxEmailsAction({ filter: "replies" });
    expect(replyRes.success).toBe(true);
    for (const email of replyRes.data) {
      expect(Boolean(email.leadId || email.contactId || email.inReplyTo)).toBe(true);
    }

    // Test search
    const searchRes = await getInboxEmailsAction({ search: "Elena" });
    expect(searchRes.success).toBe(true);
    expect(searchRes.data.length).toBeGreaterThan(0);
    expect(
      searchRes.data.some(
        (e) =>
          e.fromName.includes("Elena") ||
          e.fromEmail.includes("elena") ||
          e.leadName?.includes("Elena")
      )
    ).toBe(true);
  });

  it("marks email as read and unread", async () => {
    const list = await getInboxEmailsAction({ filter: "all" });
    const targetEmail = list.data[0];
    expect(targetEmail).toBeDefined();

    // Mark as read
    const markReadRes = await markEmailAsReadAction(targetEmail.id, true);
    expect(markReadRes.success).toBe(true);
    const itemAfterRead = mockInboxStore.find((e) => e.id === targetEmail.id);
    expect(itemAfterRead?.isRead).toBe(true);

    // Mark as unread
    const markUnreadRes = await markEmailAsReadAction(targetEmail.id, false);
    expect(markUnreadRes.success).toBe(true);
    const itemAfterUnread = mockInboxStore.find((e) => e.id === targetEmail.id);
    expect(itemAfterUnread?.isRead).toBe(false);
  });

  it("deletes an email from the inbox using deleteInboxEmailAction", async () => {
    const res = await deleteInboxEmailAction("test_msg_1");
    expect(res.success).toBe(true);
    expect(mockInboxStore.some((e) => e.id === "test_msg_1")).toBe(false);
  });

  it("syncs incoming emails and triggers timeline activity logging", async () => {
    const syncRes = await syncInboxAction();
    expect(syncRes.success).toBe(true);
    expect(syncRes.connectedEmail).toBeDefined();
  });

  it("returns connected account status linked to outbound email address", async () => {
    mockSmtpStore["demo-org-123"] = {
      organizationId: "demo-org-123",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "infotflux@gmail.com",
      encryptedPassword: encryptSecret("mock-app-password"),
      fromName: "Techflux Solutions",
      fromEmail: "infotflux@gmail.com",
      updatedAt: new Date().toISOString(),
    };

    const statusRes = await getInboxAccountStatusAction();
    expect(statusRes.success).toBe(true);
    expect(statusRes.data.isConfigured).toBe(true);
    expect(statusRes.data.connectedEmail).toBe("infotflux@gmail.com");
    expect(statusRes.data.provider).toContain("Gmail");
  });

  it("validates reply input parameters before dispatching", async () => {
    const invalidReply = await replyToClientAction({
      emailId: "",
      to: "not-an-email",
      subject: "",
      body: "",
    });

    expect(invalidReply.success).toBe(false);
    expect(invalidReply.error).toBeDefined();
  });
});

describe("MIME Header Decoding & Multipart Boundary Stripping (RFC 2047)", () => {
  it("decodes RFC 2047 Quoted-Printable encoded subject line from Gmail/client", () => {
    // Exact subject reported by user
    const encodedSubject =
      "=?UTF-8?Q?Re=3A_Following_up_on_our_conversation_=E2=80=94_your_compan?=";
    const decoded = decodeMimeHeader(encodedSubject);
    expect(decoded).toBe(
      "Re: Following up on our conversation — your compan"
    );
  });

  it("decodes RFC 2047 Base64 encoded headers", () => {
    const b64 = "=?UTF-8?B?UmU6IFJveHggQ1JNIFByb3Bvc2Fs?=";
    expect(decodeMimeHeader(b64)).toBe("Re: Roxx CRM Proposal");
  });

  it("decodes multiple adjacent RFC 2047 words and unfolds continuation lines", () => {
    const multiline =
      "=?UTF-8?Q?Hello_?= \r\n =?UTF-8?Q?World_?= \n\t =?UTF-8?Q?from_Roxx?=";
    expect(decodeMimeHeader(multiline)).toBe("Hello World from Roxx");
  });

  it("decodes quoted-printable body strings and handles soft line breaks", () => {
    const qpBody =
      "We would love to schedule a demo=\r\n on Tuesday=20=E2=80=94 let us know!";
    const decoded = decodeQuotedPrintable(qpBody);
    expect(decoded).toBe(
      "We would love to schedule a demo on Tuesday — let us know!"
    );
  });

  it("strips raw multipart MIME boundaries and headers, extracting clean body text", () => {
    // Exact structure matching user's issue screenshot
    const rawMultipart = `
--0000000000009d53d3065cc458b1
Content-Type: text/plain; charset="UTF-8"
Content-Transfer-Encoding: quoted-printable

Hello Roxx CRM Team,

Thanks for reaching out! We received your proposal and would love to connect.

Best regards,
Elena
--0000000000009d53d3065cc458b1
Content-Type: text/html; charset="UTF-8"

<div dir="ltr">Hello Roxx CRM Team,<br>Thanks for reaching out!</div>
--0000000000009d53d3065cc458b1--
    `;

    const cleaned = cleanMimeBody(rawMultipart);

    // Boundary identifiers and MIME subheaders MUST be stripped completely
    expect(cleaned.cleanText).not.toContain("--0000000000009d53d3065cc458b1");
    expect(cleaned.cleanText).not.toContain("Content-Type:");
    expect(cleaned.cleanText).not.toContain("Content-Transfer-Encoding:");
    expect(cleaned.cleanText).toContain("Hello Roxx CRM Team,");
    expect(cleaned.cleanText).toContain("Thanks for reaching out!");
    expect(cleaned.cleanText).toContain("Best regards,\nElena");
  });

  it("automatically sanitizes cached un-decoded emails when getInboxEmailsAction is invoked", async () => {
    // Push an un-decoded email into mockInboxStore
    const dirtyEmailId = "msg_dirty_mime_test";
    mockInboxStore.push({
      id: dirtyEmailId,
      organizationId: "demo-org-123",
      messageId: "<test-dirty@mail.com>",
      fromEmail: "client@test.com",
      fromName: "=?UTF-8?Q?John_D=C3=B6e?=",
      toEmail: "infotflux@gmail.com",
      subject: "=?UTF-8?Q?Re=3A_Quote_Followup?=",
      snippet: "--0000000000009d53d3065cc458b1 Content-Type: text/plain",
      bodyText: "--0000000000009d53d3065cc458b1\nContent-Type: text/plain\n\nYes, we agree to terms.",
      date: new Date().toISOString(),
      isRead: false,
    });

    const res = await getInboxEmailsAction({ filter: "all" });
    expect(res.success).toBe(true);

    const found = res.data.find((e) => e.id === dirtyEmailId);
    expect(found).toBeDefined();
    expect(found?.fromName).toBe("John Döe");
    expect(found?.subject).toBe("Re: Quote Followup");
    expect(found?.bodyText).toBe("Yes, we agree to terms.");
    expect(found?.snippet).not.toContain("--0000000000009d53d3065cc458b1");

    // Clean up
    const idx = mockInboxStore.findIndex((e) => e.id === dirtyEmailId);
    if (idx !== -1) mockInboxStore.splice(idx, 1);
  });
});

describe("Role-Based Inbox Scoping & Manager Team Filtering", () => {
  const repLeadId = "lead_sarah_client_1";
  const otherLeadId = "lead_john_client_2";
  const repEmailId = "inbox_msg_rep_scoped_1";
  const otherEmailId = "inbox_msg_other_scoped_2";

  beforeEach(() => {
    // Clean mock leads and inbox for scoping tests
    mockLeadsStore.push(
      {
        id: repLeadId,
        organizationId: "demo-org-123",
        leadNumber: "LEAD-991",
        firstName: "Alice",
        lastName: "Client",
        fullName: "Alice Client",
        email: "alice@repclient.com",
        phone: null,
        companyName: "Alice Corp",
        jobTitle: "CTO",
        sourceId: "src_1",
        sourceName: "Website",
        statusId: "st_1",
        statusName: "New",
        ownerId: "usr_sarah",
        ownerName: "Sarah Miller",
        score: 50,
        tags: [],
        createdAt: new Date().toISOString(),
      },
      {
        id: otherLeadId,
        organizationId: "demo-org-123",
        leadNumber: "LEAD-992",
        firstName: "Bob",
        lastName: "Client",
        fullName: "Bob Client",
        email: "bob@otherclient.com",
        phone: null,
        companyName: "Bob Corp",
        jobTitle: "CEO",
        sourceId: "src_1",
        sourceName: "Website",
        statusId: "st_1",
        statusName: "New",
        ownerId: "usr_john",
        ownerName: "John Rep",
        score: 50,
        tags: [],
        createdAt: new Date().toISOString(),
      }
    );

    mockInboxStore.push(
      {
        id: repEmailId,
        organizationId: "demo-org-123",
        messageId: "<sarah-client-msg@mail.com>",
        fromEmail: "alice@repclient.com",
        fromName: "Alice Client",
        toEmail: "sales@roxx.local",
        subject: "Question about our proposal",
        snippet: "Hi Sarah, wanted to follow up.",
        bodyText: "Hi Sarah, wanted to follow up on the proposal.",
        date: new Date().toISOString(),
        isRead: false,
        leadId: repLeadId,
      },
      {
        id: otherEmailId,
        organizationId: "demo-org-123",
        messageId: "<other-client-msg@mail.com>",
        fromEmail: "bob@otherclient.com",
        fromName: "Bob Client",
        toEmail: "sales@roxx.local",
        subject: "Contract questions",
        snippet: "Hi John, review complete.",
        bodyText: "Hi John, review complete for Bob Corp.",
        date: new Date().toISOString(),
        isRead: false,
        leadId: otherLeadId,
      }
    );
  });

  afterEach(() => {
    const lIdx1 = mockLeadsStore.findIndex((l) => l.id === repLeadId);
    if (lIdx1 !== -1) mockLeadsStore.splice(lIdx1, 1);
    const lIdx2 = mockLeadsStore.findIndex((l) => l.id === otherLeadId);
    if (lIdx2 !== -1) mockLeadsStore.splice(lIdx2, 1);

    const eIdx1 = mockInboxStore.findIndex((e) => e.id === repEmailId);
    if (eIdx1 !== -1) mockInboxStore.splice(eIdx1, 1);
    const eIdx2 = mockInboxStore.findIndex((e) => e.id === otherEmailId);
    if (eIdx2 !== -1) mockInboxStore.splice(eIdx2, 1);
  });

  it("allows Admin and Manager to view all company client emails with enriched rep info", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      id: "usr_admin",
      organizationId: "demo-org-123",
      organizationName: "Demo Company",
      email: "admin@roxx-crm.local",
      name: "Admin User",
      role: "ADMIN",
      permissions: ["leads:read"],
      expiresAt: Date.now() + 3600000,
    });

    const res = await getInboxEmailsAction({ filter: "all" });
    expect(res.success).toBe(true);

    const emailIds = res.data.map((e) => e.id);
    expect(emailIds).toContain(repEmailId);
    expect(emailIds).toContain(otherEmailId);

    const repEmail = res.data.find((e) => e.id === repEmailId);
    expect(repEmail?.assignedToName).toBe("Sarah Miller");
    expect(repEmail?.leadName).toBe("Alice Client");

    const otherEmail = res.data.find((e) => e.id === otherEmailId);
    expect(otherEmail?.assignedToName).toBe("John Rep");
  });

  it("strictly scopes Sales Reps to only their own assigned clients", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      id: "usr_sarah",
      organizationId: "demo-org-123",
      organizationName: "Demo Company",
      email: "sarah@roxx-crm.local",
      name: "Sarah Miller",
      role: "SALES_USER",
      permissions: ["leads:read"],
      expiresAt: Date.now() + 3600000,
    });

    const res = await getInboxEmailsAction({ filter: "all" });
    expect(res.success).toBe(true);

    const emailIds = res.data.map((e) => e.id);
    // MUST contain Sarah's client email
    expect(emailIds).toContain(repEmailId);
    // MUST NOT contain John's client email
    expect(emailIds).not.toContain(otherEmailId);
  });

  it("allows Admin to filter inbox by specific sales rep assignee", async () => {
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      id: "usr_admin",
      organizationId: "demo-org-123",
      organizationName: "Demo Company",
      email: "admin@roxx-crm.local",
      name: "Admin User",
      role: "MANAGER",
      permissions: ["leads:read"],
      expiresAt: Date.now() + 3600000,
    });

    // Filter by Sarah Miller
    const res = await getInboxEmailsAction({ assignedTo: "usr_sarah" });
    expect(res.success).toBe(true);

    const emailIds = res.data.map((e) => e.id);
    expect(emailIds).toContain(repEmailId);
    expect(emailIds).not.toContain(otherEmailId);
  });
});

describe("Client Reply Sync, Lead Timeline Activity, Read Status & Editable Subject", () => {
  const leadId = "lead_sakshi_99";
  const repUserId = "usr_rushikesh";
  const clientEmail = "sakshi@techflux.in";

  beforeEach(() => {
    mockLeadsStore.push({
      id: leadId,
      organizationId: "demo-org-123",
      leadNumber: "LEAD-1099",
      firstName: "Sakshi",
      lastName: "Badgujar",
      fullName: "Sakshi Badgujar",
      email: clientEmail,
      phone: null,
      companyName: "Techflux Corp",
      jobTitle: "Founder",
      sourceId: "src_1",
      sourceName: "Website",
      statusId: "st_1",
      statusName: "Contacted",
      ownerId: repUserId,
      ownerName: "Rushikesh",
      score: 80,
      tags: [],
      createdAt: new Date().toISOString(),
    });

    mockImapStore["demo-org-123"] = {
      organizationId: "demo-org-123",
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      username: "infotflux@gmail.com",
      encryptedPassword: encryptSecret("mock-imap-password"),
      updatedAt: new Date().toISOString(),
    };

    mockSmtpStore["demo-org-123"] = {
      organizationId: "demo-org-123",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "infotflux@gmail.com",
      encryptedPassword: encryptSecret("mock-smtp-password"),
      fromName: "Techflux Team",
      fromEmail: "infotflux@gmail.com",
      updatedAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    const lIdx = mockLeadsStore.findIndex((l) => l.id === leadId);
    if (lIdx !== -1) mockLeadsStore.splice(lIdx, 1);

    const emailIndices = mockInboxStore
      .map((e, idx) => (e.fromEmail === clientEmail ? idx : -1))
      .filter((idx) => idx !== -1)
      .reverse();
    for (const idx of emailIndices) {
      mockInboxStore.splice(idx, 1);
    }

    const actIndices = mockActivitiesStore
      .map((a, idx) => (a.leadId === leadId ? idx : -1))
      .filter((idx) => idx !== -1)
      .reverse();
    for (const idx of actIndices) {
      mockActivitiesStore.splice(idx, 1);
    }
  });

  it("links incoming client reply to Lead and logs Activity with outcome REPLY_RECEIVED on the lead timeline", async () => {
    vi.spyOn(imapModule, "fetchImapInbox").mockResolvedValue({
      success: true,
      messages: [
        {
          messageId: "<sakshi-reply-001@techflux.in>",
          fromRaw: "Sakshi Badgujar <sakshi@techflux.in>",
          fromName: "Sakshi Badgujar",
          fromEmail: clientEmail,
          toEmail: "infotflux@gmail.com",
          subject: "Re: Roxx CRM Implementation",
          snippet: "Hello Rushikesh, we are interested in moving forward.",
          bodyText: "Hello Rushikesh,\n\nWe are interested in moving forward with Roxx CRM.",
          date: "2026-10-01T10:00:00.000Z",
        },
      ],
    });

    const syncRes = await syncInboxAction();
    expect(syncRes.success).toBe(true);
    expect(syncRes.syncedReplies).toBe(1);

    // 1. Verify email in inbox is linked to lead and assigned to Rushikesh
    const inboxEmail = mockInboxStore.find(
      (e) => e.organizationId === "demo-org-123" && e.fromEmail === clientEmail
    );
    expect(inboxEmail).toBeDefined();
    expect(inboxEmail?.leadId).toBe(leadId);
    expect(inboxEmail?.leadName).toBe("Sakshi Badgujar");
    expect(inboxEmail?.assignedToName).toBe("Rushikesh");

    // 2. Verify Activity was logged on Lead Interaction Timeline with REPLY_RECEIVED
    const activity = mockActivitiesStore.find(
      (a) => a.leadId === leadId && a.outcome === "REPLY_RECEIVED"
    );
    expect(activity).toBeDefined();
    expect(activity?.type).toBe("EMAIL");
    expect(activity?.subject).toContain("Re: Roxx CRM Implementation");
    expect(activity?.description).toContain("From: Sakshi Badgujar <sakshi@techflux.in>");

    // 3. Verify Sales Rep Rushikesh can see this client reply in their scoped inbox
    vi.spyOn(sessionModule, "getSession").mockResolvedValue({
      id: repUserId,
      organizationId: "demo-org-123",
      organizationName: "Demo Company",
      email: "rushikesh@roxx-crm.local",
      name: "Rushikesh",
      role: "SALES_USER",
      permissions: ["leads:read"],
      expiresAt: Date.now() + 3600000,
    });

    const repInboxRes = await getInboxEmailsAction({ filter: "all" });
    expect(repInboxRes.success).toBe(true);
    expect(repInboxRes.data.some((e) => e.fromEmail === clientEmail)).toBe(true);
  });

  it("preserves read state on mailbox sync and prevents duplicate email rows", async () => {
    vi.spyOn(imapModule, "fetchImapInbox").mockResolvedValue({
      success: true,
      messages: [
        {
          messageId: "<sakshi-reply-002@techflux.in>",
          fromRaw: "Sakshi Badgujar <sakshi@techflux.in>",
          fromName: "Sakshi Badgujar",
          fromEmail: clientEmail,
          toEmail: "infotflux@gmail.com",
          subject: "Re: Quotation",
          snippet: "Let's proceed.",
          bodyText: "Let's proceed.",
          date: "2026-10-01T11:00:00.000Z",
        },
      ],
    });

    // First sync
    const firstSync = await syncInboxAction();
    expect(firstSync.success).toBe(true);

    const email = mockInboxStore.find((e) => e.messageId === "<sakshi-reply-002@techflux.in>");
    expect(email).toBeDefined();
    expect(email?.isRead).toBe(false);

    // Mark as read
    const markRes = await markEmailAsReadAction(email!.id, true);
    expect(markRes.success).toBe(true);
    expect(email?.isRead).toBe(true);

    // Second sync with identical message from IMAP server
    const secondSync = await syncInboxAction();
    expect(secondSync.success).toBe(true);

    // Verify no duplicates created
    const matchingEmails = mockInboxStore.filter(
      (e) => e.messageId === "<sakshi-reply-002@techflux.in>"
    );
    expect(matchingEmails.length).toBe(1);

    // CRITICAL REQUIREMENT: isRead MUST remain true and NOT reset to unread!
    expect(matchingEmails[0].isRead).toBe(true);
  });

  it("allows custom editable subject line when sending a reply", async () => {
    const emailId = "inbox_sakshi_reply_test";
    mockInboxStore.push({
      id: emailId,
      organizationId: "demo-org-123",
      messageId: "<sakshi-origin@techflux.in>",
      fromEmail: clientEmail,
      fromName: "Sakshi Badgujar",
      toEmail: "infotflux@gmail.com",
      subject: "Inquiry",
      snippet: "Can you send the pricing?",
      bodyText: "Can you send the pricing?",
      date: new Date().toISOString(),
      isRead: true,
      leadId,
    });

    const sendSmtpSpy = vi.spyOn(mailerModule, "sendSmtpEmail").mockResolvedValue({
      success: true,
      messageId: "<reply-sent-999@roxx>",
    });

    const customSubject = "Customized Quote & Timeline for Techflux Team";
    const replyRes = await replyToClientAction({
      emailId,
      to: clientEmail,
      subject: customSubject,
      body: "Here is our updated quote and deployment roadmap.",
      leadId,
      inReplyTo: "<sakshi-origin@techflux.in>",
    });

    expect(replyRes.error).toBeUndefined();
    expect(replyRes.success).toBe(true);
    expect(sendSmtpSpy).toHaveBeenCalled();
    const callArgs = sendSmtpSpy.mock.calls[0][1];
    expect(callArgs.subject).toBe(customSubject);
  });
});


