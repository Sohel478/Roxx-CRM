import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockAiConfigsStore,
  mockLeadsStore,
  mockLeadDiscoveriesStore,
  type MockAiConfig,
} from "@/lib/db/mock-store";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_test_1",
  organizationId: "org_ai_rbac_test",
  organizationName: "Security Test Org",
  email: "admin@security.test",
  name: "Security Admin",
  role: "ADMIN",
  permissions: ["settings:read", "settings:update"],
};

vi.mock("@/lib/auth/session", () => ({
  requireAuth: vi.fn(async () => mockSessionUser),
  requirePermission: vi.fn(async () => mockSessionUser),
  requireAdmin: vi.fn(async () => {
    const rUpper = mockSessionUser.role?.toUpperCase();
    if (rUpper !== "ADMIN" && rUpper !== "ADMINISTRATOR" && !mockSessionUser.isSuperAdmin) {
      throw new Error("Unauthorized: Administrator privileges required");
    }
    return mockSessionUser;
  }),
  getSession: vi.fn(async () => mockSessionUser),
}));

import {
  saveAiConfigAction,
  getAiConfigAction,
  testAiConnectionAction,
} from "@/actions/ai-email";
import {
  extractCompanyMatrixFromUrlAction,
  saveCompanyMatrixAction,
  removeCompanyDocumentAction,
} from "@/actions/company-matrix";
import { generateLeadDiscoveryAction } from "@/actions/lead-discovery";

describe("AI Key & Settings Role-Based Access Control (RBAC)", () => {
  beforeEach(() => {
    Object.keys(mockAiConfigsStore).forEach((k) => delete mockAiConfigsStore[k]);
    mockLeadsStore.length = 0;
    Object.keys(mockLeadDiscoveriesStore).forEach((k) => delete mockLeadDiscoveriesStore[k]);

    // Default to ADMIN
    mockSessionUser = {
      id: "usr_admin_1",
      organizationId: "org_ai_rbac_test",
      organizationName: "Security Test Org",
      email: "admin@security.test",
      name: "Security Admin",
      role: "ADMIN",
      permissions: ["settings:read", "settings:update"],
    };
  });

  describe("1. saveAiConfigAction RBAC enforcement", () => {
    it("allows ADMIN to save AI config and API key", async () => {
      mockSessionUser.role = "ADMIN";
      const res = await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: "sk-proj-admin-secret-key-12345",
        defaultCompanyPitch: "Leading B2B Cloud Solutions",
        defaultFollowUpDays: 3,
        defaultPacingMinutes: 2,
      });

      expect(res.success).toBe(true);
      expect(res.message).toContain("updated successfully");
    });

    it("allows ADMINISTRATOR to save AI config and API key", async () => {
      mockSessionUser.role = "ADMINISTRATOR";
      const res = await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: "sk-proj-admin-secret-key-12345",
      });

      expect(res.success).toBe(true);
    });

    it("blocks MANAGER from saving AI config or API key", async () => {
      mockSessionUser.role = "MANAGER";
      const res = await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: "sk-proj-manager-tamper-key",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden: Only Administrators can configure AI settings and API keys.");
    });

    it("blocks SALES_USER / Sales Rep from saving AI config or API key", async () => {
      mockSessionUser.role = "SALES_USER";
      const res = await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: "sk-proj-sales-tamper-key",
      });

      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden: Only Administrators can configure AI settings and API keys.");
    });

    it("blocks READ_ONLY user from saving AI config", async () => {
      mockSessionUser.role = "READ_ONLY";
      const res = await saveAiConfigAction({
        aiProvider: "builtin",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });
  });

  describe("2. testAiConnectionAction RBAC enforcement", () => {
    it("allows ADMIN to test AI connection", async () => {
      mockSessionUser.role = "ADMIN";
      const res = await testAiConnectionAction({
        provider: "builtin",
      });
      expect(res.success).toBe(true);
    });

    it("blocks MANAGER from testing AI connection", async () => {
      mockSessionUser.role = "MANAGER";
      const res = await testAiConnectionAction({
        provider: "openai",
        apiKey: "sk-proj-test",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden: Only Administrators can test AI provider keys.");
    });

    it("blocks SALES_USER from testing AI connection", async () => {
      mockSessionUser.role = "SALES_USER";
      const res = await testAiConnectionAction({
        provider: "openai",
        apiKey: "sk-proj-test",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Forbidden: Only Administrators can test AI provider keys.");
    });
  });

  describe("3. getAiConfigAction Redaction & Exposure Control", () => {
    beforeEach(async () => {
      mockSessionUser.role = "ADMIN";
      await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: "sk-proj-real-secret-key-99999",
        defaultCompanyPitch: "World leader in software delivery",
      });
    });

    it("returns raw API key to ADMIN client callers", async () => {
      mockSessionUser.role = "ADMIN";
      const res = await getAiConfigAction();
      expect(res.success).toBe(true);
      expect(res.data?.apiKey).toBe("sk-proj-real-secret-key-99999");
    });

    it("redacts raw API key to '••••••••' for MANAGER client callers", async () => {
      mockSessionUser.role = "MANAGER";
      const res = await getAiConfigAction();
      expect(res.success).toBe(true);
      expect(res.data?.apiKey).toBe("••••••••");
      // But provider information is still accessible
      expect(res.data?.aiProvider).toBe("openai");
    });

    it("redacts raw API key to '••••••••' for SALES_USER client callers", async () => {
      mockSessionUser.role = "SALES_USER";
      const res = await getAiConfigAction();
      expect(res.success).toBe(true);
      expect(res.data?.apiKey).toBe("••••••••");
    });

    it("returns raw API key for internal server operations even if rep is initiating", async () => {
      mockSessionUser.role = "SALES_USER";
      const res = await getAiConfigAction({ internalServerCall: true });
      expect(res.success).toBe(true);
      expect(res.data?.apiKey).toBe("sk-proj-real-secret-key-99999");
    });
  });

  describe("4. Company Capabilities Matrix RBAC enforcement", () => {
    it("blocks non-admin from extracting matrix from URL", async () => {
      mockSessionUser.role = "SALES_USER";
      const res = await extractCompanyMatrixFromUrlAction({ url: "https://example.com" });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("blocks non-admin from saving capabilities matrix", async () => {
      mockSessionUser.role = "MANAGER";
      const res = await saveCompanyMatrixAction({
        websiteUrl: "https://example.com",
        elevatorPitch: "Pitch",
        coreSkillsets: [],
        serviceOfferings: [],
        targetIndustries: [],
        caseStudies: [],
        outOfScopeExclusions: [],
        sourceDocuments: [],
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });

    it("blocks non-admin from removing matrix document", async () => {
      mockSessionUser.role = "SALES_USER";
      const res = await removeCompanyDocumentAction("doc_123");
      expect(res.success).toBe(false);
      expect(res.error).toContain("Forbidden");
    });
  });

  describe("5. End-to-End Sales Rep Discovery Execution without Key Exposure", () => {
    it("allows SALES_USER to run lead discovery using admin-configured AI", async () => {
      // 1. Admin sets up OpenAI config
      mockSessionUser.role = "ADMIN";
      await saveAiConfigAction({
        aiProvider: "openai",
        apiKey: "sk-proj-admin-configured-key",
      });

      // 2. Lead is present in system
      mockLeadsStore.push({
        id: "lead_test_rep",
        organizationId: "org_ai_rbac_test",
        leadNumber: "LEAD-101",
        firstName: "Marcus",
        lastName: "Aurelius",
        fullName: "Marcus Aurelius",
        email: "marcus@meditations.org",
        website: "https://meditations.org",
        phone: "+1 555-0101",
        companyName: "Stoic Philosophy Inc",
        source: "Inbound",
        status: "New",
        rating: "Hot",
        estimatedValue: 25000,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });

      // 3. Sales rep runs discovery
      mockSessionUser.role = "SALES_USER";
      const discRes = await generateLeadDiscoveryAction("lead_test_rep");

      expect(discRes.success).toBe(true);
      expect(discRes.data).toBeDefined();
      expect(discRes.data?.companyOverviewDetails?.companyName).toBe("Stoic Philosophy Inc");
    });
  });
});
