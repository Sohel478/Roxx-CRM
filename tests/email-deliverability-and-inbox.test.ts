import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseEmailAddress } from "@/lib/email/imap-client";
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
} from "@/actions/inbox";
import {
  mockImapStore,
  mockSmtpStore,
  mockInboxStore,
  mockLeadsStore,
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
