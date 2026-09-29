import { describe, it, expect, vi, beforeEach } from "vitest";
import { resetCrmDataSchema } from "@/lib/validations/data-management";
import {
  getDataCountsAction,
  resetCrmDataAction,
} from "@/actions/data-management";
import {
  mockLeadsStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
  mockAuditLogsStore,
} from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";

describe("CRM Data Reset & Wipe Management", () => {
  describe("Validation Schema (resetCrmDataSchema)", () => {
    it("accepts valid entities with exact confirmation phrase RESET", () => {
      const entities = ["leads", "companies", "contacts", "all"] as const;
      for (const entity of entities) {
        const result = resetCrmDataSchema.safeParse({
          entity,
          confirmationText: "RESET",
        });
        expect(result.success).toBe(true);
      }
    });

    it("accepts case-insensitive and whitespace-padded RESET", () => {
      const result = resetCrmDataSchema.safeParse({
        entity: "leads",
        confirmationText: "  reset  ",
      });
      expect(result.success).toBe(true);
    });

    it("rejects confirmation text other than RESET", () => {
      const invalidWords = ["DELETE", "CONFIRM", "YES", "wipe", "123", ""];
      for (const word of invalidWords) {
        const result = resetCrmDataSchema.safeParse({
          entity: "leads",
          confirmationText: word,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].message).toContain("RESET");
        }
      }
    });

    it("rejects unsupported entity types", () => {
      const result = resetCrmDataSchema.safeParse({
        entity: "users",
        confirmationText: "RESET",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Server Actions: Authorization & Tenant Isolation", () => {
    const ORG_A = "org_alpha_reset_test";
    const ORG_B = "org_beta_preserve_test";

    beforeEach(() => {
      vi.restoreAllMocks();

      // Seed test data for ORG_A
      mockLeadsStore.push({
        id: "lead_alpha_1",
        organizationId: ORG_A,
        leadNumber: "LD-A1",
        firstName: "Alpha",
        lastName: "Lead",
        fullName: "Alpha Lead",
        email: "alpha@test.com",
        phone: "+1234567890",
        companyName: "Alpha Corp",
        jobTitle: "CTO",
        source: "Inbound",
        status: "New",
        rating: "Hot",
        estimatedValue: 10000,
        currency: "USD",
        ownerName: "Sarah Rep",
        createdAt: new Date().toISOString(),
      });

      mockCompaniesStore.push({
        id: "comp_alpha_1",
        organizationId: ORG_A,
        name: "Alpha Corp",
        industry: "Technology",
        website: "https://alpha.example.com",
        email: "info@alpha.com",
        phone: "+1234567890",
        city: "San Francisco",
        country: "USA",
        status: "Active",
        createdAt: new Date().toISOString(),
        contactCount: 1,
      });

      mockContactsStore.push({
        id: "cont_alpha_1",
        organizationId: ORG_A,
        firstName: "Alice",
        lastName: "Alpha",
        fullName: "Alice Alpha",
        email: "alice@alpha.com",
        phone: "+1234567890",
        jobTitle: "VP Sales",
        department: "Sales",
        companyId: "comp_alpha_1",
        companyName: "Alpha Corp",
        createdAt: new Date().toISOString(),
      });

      mockOpportunitiesStore.push({
        id: "opp_alpha_1",
        organizationId: ORG_A,
        name: "Alpha Cloud Deal",
        amount: 50000,
        currency: "USD",
        companyId: "comp_alpha_1",
        companyName: "Alpha Corp",
        primaryContactId: "cont_alpha_1",
        primaryContactName: "Alice Alpha",
        leadId: null,
        pipelineId: "pipe_1",
        stageId: "stage_proposal",
        stageName: "Proposal",
        probability: 60,
        ownerId: "usr_admin",
        ownerName: "Admin User",
        status: "OPEN",
        lossReason: null,
        description: null,
        expectedCloseDate: null,
        closedAt: null,
        createdAt: new Date().toISOString(),
      });

      // Seed test data for ORG_B (Tenant to preserve)
      mockLeadsStore.push({
        id: "lead_beta_1",
        organizationId: ORG_B,
        leadNumber: "LD-B1",
        firstName: "Beta",
        lastName: "Lead",
        fullName: "Beta Lead",
        email: "beta@test.com",
        phone: "+9876543210",
        companyName: "Beta Corp",
        jobTitle: "CEO",
        source: "Referral",
        status: "Qualified",
        rating: "Warm",
        estimatedValue: 25000,
        currency: "USD",
        ownerName: "Alex Rep",
        createdAt: new Date().toISOString(),
      });

      mockCompaniesStore.push({
        id: "comp_beta_1",
        organizationId: ORG_B,
        name: "Beta Corp",
        industry: "Finance",
        website: "https://beta.example.com",
        email: "info@beta.com",
        phone: "+9876543210",
        city: "New York",
        country: "USA",
        status: "Active",
        createdAt: new Date().toISOString(),
        contactCount: 1,
      });

      mockContactsStore.push({
        id: "cont_beta_1",
        organizationId: ORG_B,
        firstName: "Bob",
        lastName: "Beta",
        fullName: "Bob Beta",
        email: "bob@beta.com",
        phone: "+9876543210",
        jobTitle: "CFO",
        department: "Finance",
        companyId: "comp_beta_1",
        companyName: "Beta Corp",
        createdAt: new Date().toISOString(),
      });
    });

    it("getDataCountsAction returns non-zero counts for organization", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: ORG_A,
        organizationName: "Alpha Organization",
        email: "admin@alpha.com",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await getDataCountsAction();
      expect(res.success).toBe(true);
      expect(res.data?.leadsCount).toBeGreaterThanOrEqual(1);
      expect(res.data?.companiesCount).toBeGreaterThanOrEqual(1);
      expect(res.data?.contactsCount).toBeGreaterThanOrEqual(1);
      expect(res.data?.opportunitiesCount).toBeGreaterThanOrEqual(1);
    });

    it("resetCrmDataAction blocks non-admin users (SALES_USER)", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_sales",
        organizationId: ORG_A,
        organizationName: "Alpha Organization",
        email: "sales@alpha.com",
        name: "Sales User",
        role: "SALES_USER",
        permissions: ["lead:read", "lead:create"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await resetCrmDataAction({
        entity: "leads",
        confirmationText: "RESET",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Only Organization Admins");
      // Leads should remain untouched
      expect(mockLeadsStore.some((l) => l.organizationId === ORG_A)).toBe(true);
    });

    it("resetCrmDataAction allows Admin to wipe leads without touching other tenants or entities", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: ORG_A,
        organizationName: "Alpha Organization",
        email: "admin@alpha.com",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await resetCrmDataAction({
        entity: "leads",
        confirmationText: "RESET",
      });

      expect(res.success).toBe(true);
      // ORG_A leads are wiped
      expect(mockLeadsStore.some((l) => l.organizationId === ORG_A)).toBe(false);
      // ORG_B leads are safely preserved
      expect(mockLeadsStore.some((l) => l.organizationId === ORG_B)).toBe(true);
      // Companies & Contacts of ORG_A remain untouched
      expect(mockCompaniesStore.some((c) => c.organizationId === ORG_A)).toBe(true);
      expect(mockContactsStore.some((c) => c.organizationId === ORG_A)).toBe(true);
    });

    it("resetCrmDataAction wipes companies and associated opportunities and unlinks contacts", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: ORG_A,
        organizationName: "Alpha Organization",
        email: "admin@alpha.com",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await resetCrmDataAction({
        entity: "companies",
        confirmationText: "RESET",
      });

      expect(res.success).toBe(true);
      // ORG_A companies wiped
      expect(mockCompaniesStore.some((c) => c.organizationId === ORG_A)).toBe(false);
      // Opportunities wiped
      expect(mockOpportunitiesStore.some((o) => o.organizationId === ORG_A)).toBe(false);
      // Contact companyId is unlinked
      const orgAContact = mockContactsStore.find((c) => c.organizationId === ORG_A);
      expect(orgAContact?.companyId).toBeNull();
      // ORG_B preserved
      expect(mockCompaniesStore.some((c) => c.organizationId === ORG_B)).toBe(true);
    });

    it("resetCrmDataAction wipes all CRM records when entity is 'all' and logs audit log", async () => {
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: ORG_A,
        organizationName: "Alpha Organization",
        email: "admin@alpha.com",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await resetCrmDataAction({
        entity: "all",
        confirmationText: "RESET",
      });

      expect(res.success).toBe(true);
      // All entities wiped for ORG_A
      expect(mockLeadsStore.some((l) => l.organizationId === ORG_A)).toBe(false);
      expect(mockCompaniesStore.some((c) => c.organizationId === ORG_A)).toBe(false);
      expect(mockContactsStore.some((c) => c.organizationId === ORG_A)).toBe(false);
      expect(mockOpportunitiesStore.some((o) => o.organizationId === ORG_A)).toBe(false);

      // ORG_B strictly preserved
      expect(mockLeadsStore.some((l) => l.organizationId === ORG_B)).toBe(true);
      expect(mockCompaniesStore.some((c) => c.organizationId === ORG_B)).toBe(true);
      expect(mockContactsStore.some((c) => c.organizationId === ORG_B)).toBe(true);

      // Audit log entry created
      const audit = mockAuditLogsStore.find(
        (a) => a.organizationId === ORG_A && a.action === "DATA_RESET"
      );
      expect(audit).toBeDefined();
      expect(audit?.entityType).toBe("ALL");
    });
  });
});
