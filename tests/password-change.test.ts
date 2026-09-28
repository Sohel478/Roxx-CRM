import { describe, it, expect, vi, beforeEach } from "vitest";
import { changePasswordSchema } from "@/lib/validations/settings";
import { changePasswordAction } from "@/actions/auth";
import { mockUsersStore } from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";

describe("Password Change Feature", () => {
  describe("Validation Schema", () => {
    it("accepts valid password change payload", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "password123",
        newPassword: "newSecurePassword!99",
        confirmPassword: "newSecurePassword!99",
      });
      expect(result.success).toBe(true);
    });

    it("rejects when new password is fewer than 6 characters", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "password123",
        newPassword: "123",
        confirmPassword: "123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("at least 6 characters");
      }
    });

    it("rejects when confirm password does not match", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "password123",
        newPassword: "newSecurePassword1",
        confirmPassword: "differentPassword2",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("New passwords do not match");
      }
    });

    it("rejects when new password is identical to current password", () => {
      const result = changePasswordSchema.safeParse({
        currentPassword: "password123",
        newPassword: "password123",
        confirmPassword: "password123",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("different from current");
      }
    });
  });

  describe("changePasswordAction Server Action", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("returns error if caller is not authenticated", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue(null);

      const formData = new FormData();
      formData.append("currentPassword", "password123");
      formData.append("newPassword", "newSecretPassword!1");
      formData.append("confirmPassword", "newSecretPassword!1");

      const res = await changePasswordAction({ success: false }, formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Authentication required");
    });

    it("returns error if current password does not match", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: [],
        expiresAt: Date.now() + 3600000,
      });

      const formData = new FormData();
      formData.append("currentPassword", "wrongCurrentPassword");
      formData.append("newPassword", "brandNewPassword#1");
      formData.append("confirmPassword", "brandNewPassword#1");

      const res = await changePasswordAction({ success: false }, formData);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Current password does not match");
    });

    it("successfully changes password for active session user", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: [],
        expiresAt: Date.now() + 3600000,
      });

      const formData = new FormData();
      formData.append("currentPassword", "password123");
      formData.append("newPassword", "brandNewPassword#1");
      formData.append("confirmPassword", "brandNewPassword#1");

      const res = await changePasswordAction({ success: false }, formData);
      expect(res.success).toBe(true);
      expect(res.message).toContain("successfully");

      // Verify mock user's passwordHash was set
      const adminUser = mockUsersStore.find((u) => u.email === "admin@roxx-crm.local");
      expect(adminUser?.passwordHash).toBeDefined();
    });
  });
});
