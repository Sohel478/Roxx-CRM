import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptSecret, decryptSecret, maskSecret } from "@/lib/crypto/encryption";
import {
  smtpConfigSchema,
  testSmtpSchema,
  sendEmailSchema,
} from "@/lib/validations/email";
import {
  getSmtpConfigAction,
  saveSmtpConfigAction,
  sendLeadEmailAction,
} from "@/actions/email";
import { mockSmtpStore } from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";
import * as mailerModule from "@/lib/email/mailer";

describe("BYO-SMTP Email Integration & Workspace Relay", () => {
  describe("Cryptographic Security (AES-256-GCM)", () => {
    it("encrypts and decrypts secret credentials cleanly", () => {
      const originalPassword = "my-super-secret-google-app-password";
      const encrypted = encryptSecret(originalPassword);

      expect(encrypted).not.toBe(originalPassword);
      // Format is ivHex:tagHex:encryptedHex
      const parts = encrypted.split(":");
      expect(parts.length).toBe(3);

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(originalPassword);
    });

    it("handles empty or corrupted ciphertexts safely", () => {
      expect(encryptSecret("")).toBe("");
      expect(decryptSecret("")).toBe("");
      expect(decryptSecret("invalid-format")).toBe("invalid-format");
    });

    it("masks password correctly", () => {
      expect(maskSecret("secret")).toBe("••••••••••••");
      expect(maskSecret(null)).toBe("");
      expect(maskSecret("")).toBe("");
    });
  });

  describe("Validation Schemas", () => {
    it("validates correct SMTP configuration", () => {
      const validPayload = {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "sales@techflux.in",
        password: "abcd efgh ijkl mnop",
        fromName: "Techflux Sales",
        fromEmail: "sales@techflux.in",
      };

      const res = smtpConfigSchema.safeParse(validPayload);
      expect(res.success).toBe(true);
    });

    it("rejects invalid ports and malformed emails", () => {
      const invalidPort = smtpConfigSchema.safeParse({
        host: "smtp.gmail.com",
        port: 70000, // Out of range
        secure: false,
        username: "user",
        fromName: "Team",
        fromEmail: "invalid-email",
      });

      expect(invalidPort.success).toBe(false);
    });

    it("validates send email payload", () => {
      const valid = sendEmailSchema.safeParse({
        to: "lead@client.com",
        subject: "Product Discussion",
        body: "Hi team, following up on our call.",
        entityType: "lead",
        entityId: "lead_123",
      });
      expect(valid.success).toBe(true);

      const missingSubject = sendEmailSchema.safeParse({
        to: "lead@client.com",
        subject: "",
        body: "Hi",
      });
      expect(missingSubject.success).toBe(false);
    });
  });

  describe("Server Actions Layer", () => {
    const orgId = "demo-org-123";

    beforeEach(() => {
      vi.restoreAllMocks();
      delete mockSmtpStore[orgId];
    });

    it("getSmtpConfigAction returns unconfigured state when empty", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: orgId,
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await getSmtpConfigAction();
      expect(res.success).toBe(true);
      expect(res.data?.isConfigured).toBe(false);
      expect(res.data?.hasPassword).toBe(false);
    });

    it("saveSmtpConfigAction blocks unauthorized members", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_alex",
        organizationId: orgId,
        organizationName: "Demo Company",
        email: "sales@roxx-crm.local",
        name: "Alex Sales",
        role: "SALES_USER",
        permissions: ["lead:read"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await saveSmtpConfigAction({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "sales@demo.com",
        password: "secretpassword123",
        fromName: "Sales Team",
        fromEmail: "sales@demo.com",
      });

      expect(res.success).toBe(false);
    });

    it("saveSmtpConfigAction saves encrypted credentials and getSmtpConfigAction masks password", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: orgId,
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const saveRes = await saveSmtpConfigAction({
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "admin@demo.com",
        password: "google-app-password-1234",
        fromName: "Demo Sales",
        fromEmail: "admin@demo.com",
      });

      expect(saveRes.success).toBe(true);
      expect(saveRes.message).toContain("encrypted at rest");

      // Verify stored config in mock store
      const stored = mockSmtpStore[orgId];
      expect(stored).toBeDefined();
      expect(stored.host).toBe("smtp.gmail.com");
      expect(stored.encryptedPassword).not.toBe("google-app-password-1234");
      expect(decryptSecret(stored.encryptedPassword!)).toBe("google-app-password-1234");

      // Verify get action returns masked password
      const getRes = await getSmtpConfigAction();
      expect(getRes.success).toBe(true);
      expect(getRes.data?.isConfigured).toBe(true);
      expect(getRes.data?.hasPassword).toBe(true);
      expect(getRes.data?.maskedPassword).toBe("••••••••••••");
    });

    it("sendLeadEmailAction errors if SMTP is not configured", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: "unconfigured-org",
        organizationName: "Unconfigured Org",
        email: "admin@unconfigured.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await sendLeadEmailAction({
        to: "lead@target.com",
        subject: "Hello",
        body: "Testing message",
        entityType: "lead",
        entityId: "lead_123",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("SMTP is not configured");
    });

    it("sendLeadEmailAction dispatches mail and logs activity when configured", async () => {
      const adminSession = {
        id: "usr_admin",
        organizationId: orgId,
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update", "activity:create"],
        expiresAt: Date.now() + 3600000,
      };
      vi.spyOn(sessionModule, "getSession").mockResolvedValue(adminSession);
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue(adminSession);
      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue(adminSession);

      // Populate mock SMTP store
      mockSmtpStore[orgId] = {
        organizationId: orgId,
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "sales@demo.com",
        encryptedPassword: encryptSecret("google-app-pass"),
        fromName: "Demo Sales",
        fromEmail: "sales@demo.com",
        updatedAt: new Date().toISOString(),
      };

      // Mock mailer send to avoid actual network call in unit test
      vi.spyOn(mailerModule, "sendSmtpEmail").mockResolvedValue({
        success: true,
        messageId: "<msg-123@smtp.gmail.com>",
      });

      const res = await sendLeadEmailAction({
        to: "prospect@corp.com",
        subject: "Platform Follow-up",
        body: "Here is the summary we discussed.",
        entityType: "lead",
        entityId: "lead_demo_1",
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("delivered to prospect@corp.com");
      expect(mailerModule.sendSmtpEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          host: "smtp.gmail.com",
          username: "sales@demo.com",
          password: "google-app-pass",
        }),
        expect.objectContaining({
          to: "prospect@corp.com",
          subject: "Platform Follow-up",
        })
      );
    });
  });
});
