import { describe, it, expect, vi, beforeEach } from "vitest";
import { leadSchema } from "@/lib/validations/leads";
import {
  getLeadsAction,
  getLeadByIdAction,
  createLeadAction,
  updateLeadAction,
  assignLeadAction,
} from "@/actions/leads";
import { getMonthlyTargetsAction } from "@/actions/targets";
import { mockLeadsStore, mockUsersStore, mockSalesTargetsStore } from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Sales Rep Scoping, Lead Assignment & Quota Privacy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1 & 2. Lead Visibility Scoping and Assignment Control", () => {
    it("sales rep only sees their own leads, not other sales reps' leads", async () => {
      // Setup test leads in mock store
      const leadRep1Id = `test_lead_rep1_${Date.now()}`;
      const leadRep2Id = `test_lead_rep2_${Date.now()}`;

      mockLeadsStore.unshift(
        {
          id: leadRep1Id,
          organizationId: "demo-org-123",
          leadNumber: "LEAD-REP1",
          firstName: "Rep One",
          lastName: "Lead",
          fullName: "Rep One Lead",
          email: "customer1@client.com",
          supportEmail: "support1@client.com",
          phone: "1234567890",
          companyName: "Acme Corp",
          jobTitle: "CTO",
          source: "Website",
          status: "New",
          rating: "Warm",
          estimatedValue: 50000,
          currency: "USD",
          ownerId: "usr_rep1",
          createdById: "usr_rep1",
          ownerName: "Rep One",
          createdAt: new Date().toISOString(),
        },
        {
          id: leadRep2Id,
          organizationId: "demo-org-123",
          leadNumber: "LEAD-REP2",
          firstName: "Rep Two",
          lastName: "Lead",
          fullName: "Rep Two Lead",
          email: "customer2@client.com",
          supportEmail: "support2@client.com",
          phone: "0987654321",
          companyName: "Beta Corp",
          jobTitle: "CEO",
          source: "Referral",
          status: "New",
          rating: "Hot",
          estimatedValue: 75000,
          currency: "USD",
          ownerId: "usr_rep2",
          createdById: "usr_rep2",
          ownerName: "Rep Two",
          createdAt: new Date().toISOString(),
        }
      );

      // As Sales Rep 1: should ONLY see leadRep1Id
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx-crm.local",
        name: "Rep One",
        role: "SALES_USER",
        permissions: ["lead:read", "lead:create", "lead:update"],
        expiresAt: Date.now() + 3600000,
      });

      const rep1Leads = await getLeadsAction({ limit: 50 });
      expect(rep1Leads.success).toBe(true);
      const rep1Items = rep1Leads.data?.items || [];
      expect(rep1Items.some((l) => l.id === leadRep1Id)).toBe(true);
      expect(rep1Items.some((l) => l.id === leadRep2Id)).toBe(false);

      // Detail access for Rep 1
      const rep1OwnDetail = await getLeadByIdAction(leadRep1Id);
      expect(rep1OwnDetail.success).toBe(true);

      const rep1OtherDetail = await getLeadByIdAction(leadRep2Id);
      expect(rep1OtherDetail.success).toBe(false);
      expect(rep1OtherDetail.error).toContain("Unauthorized");

      // As Admin: should see BOTH leads
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["lead:read", "lead:create", "lead:update", "lead:assign"],
        expiresAt: Date.now() + 3600000,
      });

      const adminLeads = await getLeadsAction({ limit: 50 });
      expect(adminLeads.success).toBe(true);
      const adminItems = adminLeads.data?.items || [];
      expect(adminItems.some((l) => l.id === leadRep1Id)).toBe(true);
      expect(adminItems.some((l) => l.id === leadRep2Id)).toBe(true);

      // As Manager: should also see BOTH leads
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_sarah",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "manager@roxx-crm.local",
        name: "Sarah Manager",
        role: "MANAGER",
        permissions: ["lead:read", "lead:create", "lead:update", "lead:assign"],
        expiresAt: Date.now() + 3600000,
      });

      const managerLeads = await getLeadsAction({ limit: 50 });
      expect(managerLeads.success).toBe(true);
      const managerItems = managerLeads.data?.items || [];
      expect(managerItems.some((l) => l.id === leadRep1Id)).toBe(true);
      expect(managerItems.some((l) => l.id === leadRep2Id)).toBe(true);
    });

    it("only Admin and Manager can reassign leads; sales reps are rejected", async () => {
      const testLeadId = `lead_reassign_${Date.now()}`;
      mockLeadsStore.unshift({
        id: testLeadId,
        organizationId: "demo-org-123",
        leadNumber: "LEAD-REASSIGN",
        firstName: "Assignment",
        lastName: "Candidate",
        fullName: "Assignment Candidate",
        email: "assignee@client.com",
        phone: "1231231234",
        source: "Website",
        status: "New",
        rating: "Warm",
        estimatedValue: 10000,
        currency: "USD",
        ownerId: "usr_rep1",
        createdById: "usr_rep1",
        ownerName: "Rep One",
        createdAt: new Date().toISOString(),
      });

      // Sales rep attempts to reassign -> rejected
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx-crm.local",
        name: "Rep One",
        role: "SALES_USER",
        permissions: ["lead:update"],
        expiresAt: Date.now() + 3600000,
      });

      const repAssignRes = await assignLeadAction(testLeadId, "usr_rep2");
      expect(repAssignRes.success).toBe(false);
      expect(repAssignRes.error).toContain("Unauthorized");

      // Admin reassigns to Rep 2 -> succeeds
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["lead:assign"],
        expiresAt: Date.now() + 3600000,
      });

      const adminAssignRes = await assignLeadAction(testLeadId, "usr_rep2");
      expect(adminAssignRes.success).toBe(true);

      // Now Rep 2 can see it
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep2",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep2@roxx-crm.local",
        name: "Rep Two",
        role: "SALES_USER",
        permissions: ["lead:read"],
        expiresAt: Date.now() + 3600000,
      });

      const rep2ViewRes = await getLeadByIdAction(testLeadId);
      expect(rep2ViewRes.success).toBe(true);
      expect(rep2ViewRes.data?.ownerId).toBe("usr_rep2");
    });
  });

  describe("3. Dual Email Support: Customer Email and Support Email", () => {
    it("validates lead schema with both Customer Email and Support Email", () => {
      const valid = {
        firstName: "Alexander",
        lastName: "Hamilton",
        email: "hamilton@treasury.gov",
        supportEmail: "support@treasury.gov",
        companyName: "US Treasury",
        source: "Website",
        status: "New",
        rating: "Hot",
        estimatedValue: 100000,
        currency: "USD",
      };

      const result = leadSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("hamilton@treasury.gov");
        expect(result.data.supportEmail).toBe("support@treasury.gov");
      }
    });

    it("persists and updates both customer and support emails via server actions", async () => {
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["lead:create", "lead:update"],
        expiresAt: Date.now() + 3600000,
      });
      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["lead:create", "lead:update"],
        expiresAt: Date.now() + 3600000,
      });

      const createRes = await createLeadAction({
        firstName: "Dual",
        lastName: "EmailTest",
        email: "cust.test@domain.com",
        supportEmail: "helpdesk@domain.com",
        source: "Website",
        status: "New",
        rating: "Warm",
        estimatedValue: 25000,
        currency: "USD",
      });

      expect(createRes.success).toBe(true);
      const createdId = createRes.data?.id!;
      expect(createRes.data?.email).toBe("cust.test@domain.com");
      expect(createRes.data?.supportEmail).toBe("helpdesk@domain.com");

      const updateRes = await updateLeadAction(createdId, {
        supportEmail: "escalations@domain.com",
      });
      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.supportEmail).toBe("escalations@domain.com");
    });
  });

  describe("4 & 5. Monthly Target Privacy for Sales Reps and Full Visibility for Admins", () => {
    it("sales reps only see their own monthly quota, won revenue, and attainment with company target masked", async () => {
      // Configure mock sales targets for 2026-09
      mockSalesTargetsStore["2026-09"] = {
        orgTarget: 500000,
        userTargets: {
          usr_sarah: 200000,
          usr_alex: 150000,
          usr_rep1: 80000,
        },
      };

      // Ensure mock user usr_alex exists
      if (!mockUsersStore.some((u) => u.id === "usr_alex")) {
        mockUsersStore.push({
          id: "usr_alex",
          organizationId: "demo-org-123",
          name: "Alex Sales",
          email: "alex@roxx-crm.local",
          role: "SALES_USER",
          isActive: true,
          createdAt: new Date().toISOString(),
        });
      }

      // As Sales Rep Alex
      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_alex",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "alex@roxx-crm.local",
        name: "Alex Sales",
        role: "SALES_USER",
        permissions: ["report:view"],
        expiresAt: Date.now() + 3600000,
      });

      const repRes = await getMonthlyTargetsAction("2026-09");
      expect(repRes.success).toBe(true);
      const repData = repRes.data!;

      // Individual privacy checks
      expect(repData.isPersonalView).toBe(true);
      expect(repData.orgTarget).toBe(150000); // Masked to Alex's target, NOT 500000!
      expect(repData.users.length).toBe(1);
      expect(repData.users[0].userId).toBe("usr_alex");
      expect(repData.users[0].targetAmount).toBe(150000);
      expect(repData.users.some((u) => u.userId === "usr_sarah")).toBe(false);
    });

    it("admin sees total company quota and all team members' target attainment status", async () => {
      mockSalesTargetsStore["2026-09"] = {
        orgTarget: 500000,
        userTargets: {
          usr_sarah: 200000,
          usr_alex: 150000,
        },
      };

      vi.spyOn(sessionModule, "getSession").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx-crm.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["settings:read", "settings:update"],
        expiresAt: Date.now() + 3600000,
      });

      const adminRes = await getMonthlyTargetsAction("2026-09");
      expect(adminRes.success).toBe(true);
      const adminData = adminRes.data!;

      expect(adminData.isPersonalView).toBe(false);
      expect(adminData.orgTarget).toBe(500000); // Full org goal
      expect(adminData.users.length).toBeGreaterThanOrEqual(2);
      expect(adminData.users.some((u) => u.userId === "usr_sarah")).toBe(true);
      expect(adminData.users.some((u) => u.userId === "usr_alex")).toBe(true);
    });
  });
});
