import { describe, it, expect, vi, beforeEach } from "vitest";
import { monthlyTargetSchema } from "@/lib/validations/settings";
import {
  getMonthlyTargetsAction,
  updateMonthlyTargetsAction,
} from "@/actions/targets";
import { mockSalesTargetsStore } from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";

describe("Monthly Sales Targets & Quota Management", () => {
  describe("monthlyTargetSchema validation", () => {
    it("accepts valid monthly target payload", () => {
      const result = monthlyTargetSchema.safeParse({
        month: "2026-09",
        orgTarget: 250000,
        userTargets: [
          { userId: "usr_sarah", targetAmount: 150000 },
          { userId: "usr_alex", targetAmount: 100000 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("rejects negative organization target", () => {
      const result = monthlyTargetSchema.safeParse({
        month: "2026-09",
        orgTarget: -5000,
        userTargets: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("cannot be negative");
      }
    });

    it("rejects invalid month format", () => {
      const result = monthlyTargetSchema.safeParse({
        month: "September-2026",
        orgTarget: 100000,
        userTargets: [],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("YYYY-MM");
      }
    });

    it("rejects negative individual user target", () => {
      const result = monthlyTargetSchema.safeParse({
        month: "2026-09",
        orgTarget: 100000,
        userTargets: [{ userId: "usr_alex", targetAmount: -1000 }],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain("cannot be negative");
      }
    });
  });

  describe("Server Actions", () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it("getMonthlyTargetsAction returns monthly target data with team members", async () => {
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

      const res = await getMonthlyTargetsAction("2026-09");
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.month).toBe("2026-09");
      expect(res.data?.orgTarget).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.data?.users)).toBe(true);
    });

    it("updateMonthlyTargetsAction blocks non-admin users without settings permissions", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_alex",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "sales@roxx-crm.local",
        name: "Alex Sales",
        role: "SALES_USER",
        permissions: ["lead:read", "lead:create"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await updateMonthlyTargetsAction({
        month: "2026-09",
        orgTarget: 500000,
        userTargets: [{ userId: "usr_alex", targetAmount: 250000 }],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Only Organization Admins");
    });

    it("updateMonthlyTargetsAction allows admin to save org & individual targets", async () => {
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

      const testMonth = "2026-11";
      const res = await updateMonthlyTargetsAction({
        month: testMonth,
        orgTarget: 300000,
        userTargets: [
          { userId: "usr_sarah", targetAmount: 180000 },
          { userId: "usr_alex", targetAmount: 120000 },
        ],
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("saved successfully");

      // Verify update in mock store
      const stored = mockSalesTargetsStore[testMonth];
      expect(stored).toBeDefined();
      expect(stored.orgTarget).toBe(300000);
      expect(stored.userTargets["usr_sarah"]).toBe(180000);
      expect(stored.userTargets["usr_alex"]).toBe(120000);
    });
  });
});
