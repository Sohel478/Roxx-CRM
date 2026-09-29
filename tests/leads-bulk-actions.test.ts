import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  bulkAssignLeadsAction,
  bulkDeleteLeadsAction,
} from "@/actions/leads";
import { mockLeadsStore, mockUsersStore } from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Leads Bulk Selection, Assignment & Deletion Actions", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("bulkAssignLeadsAction", () => {
    it("Admin or Manager can bulk assign multiple leads to a selected team member", async () => {
      const orgId = "org_bulk_test";
      const leadId1 = `lead_bulk_1_${Date.now()}`;
      const leadId2 = `lead_bulk_2_${Date.now()}`;
      const targetOwnerId = "usr_target_rep";

      // Register target user in mock store
      mockUsersStore.push({
        id: targetOwnerId,
        organizationId: orgId,
        email: "target@company.com",
        name: "Target Sales Rep",
        passwordHash: "hash",
        role: "SALES_USER",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockLeadsStore.push(
        {
          id: leadId1,
          organizationId: orgId,
          leadNumber: "LEAD-B1",
          firstName: "Bulk Lead",
          lastName: "One",
          fullName: "Bulk Lead One",
          email: "bulk1@test.com",
          source: "Website",
          status: "New",
          rating: "Warm",
          estimatedValue: 10000,
          currency: "USD",
          ownerId: "usr_old_rep",
          createdById: "usr_old_rep",
          ownerName: "Old Rep",
          createdAt: new Date().toISOString(),
        },
        {
          id: leadId2,
          organizationId: orgId,
          leadNumber: "LEAD-B2",
          firstName: "Bulk Lead",
          lastName: "Two",
          fullName: "Bulk Lead Two",
          email: "bulk2@test.com",
          source: "Website",
          status: "New",
          rating: "Cold",
          estimatedValue: 20000,
          currency: "USD",
          ownerId: "usr_old_rep",
          createdById: "usr_old_rep",
          ownerName: "Old Rep",
          createdAt: new Date().toISOString(),
        }
      );

      // Mock Admin session
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        email: "admin@company.com",
        name: "Admin User",
        organizationId: orgId,
        organizationName: "Test Org",
        role: "ADMIN",
        permissions: ["lead:update", "lead:delete"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await bulkAssignLeadsAction([leadId1, leadId2], targetOwnerId);

      expect(res.success).toBe(true);
      expect(res.count).toBe(2);

      const updatedLead1 = mockLeadsStore.find((l) => l.id === leadId1);
      const updatedLead2 = mockLeadsStore.find((l) => l.id === leadId2);

      expect(updatedLead1?.ownerId).toBe(targetOwnerId);
      expect(updatedLead1?.ownerName).toBe("Target Sales Rep");
      expect(updatedLead2?.ownerId).toBe(targetOwnerId);
      expect(updatedLead2?.ownerName).toBe("Target Sales Rep");
    });

    it("Sales rep is rejected when attempting to bulk assign leads", async () => {
      const orgId = "org_bulk_test";
      const leadId = `lead_bulk_rep_${Date.now()}`;

      // Mock Sales Rep session
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep",
        email: "rep@company.com",
        name: "Sales Rep",
        organizationId: orgId,
        organizationName: "Test Org",
        role: "SALES_USER",
        permissions: ["lead:read", "lead:update"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await bulkAssignLeadsAction([leadId], "usr_rep");

      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");
    });

    it("Rejects when no lead IDs are provided", async () => {
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        email: "admin@company.com",
        name: "Admin User",
        organizationId: "org_test",
        organizationName: "Test Org",
        role: "ADMIN",
        permissions: [],
        expiresAt: Date.now() + 3600000,
      });

      const res = await bulkAssignLeadsAction([], "usr_target");
      expect(res.success).toBe(false);
      expect(res.error).toContain("No leads selected");
    });
  });

  describe("bulkDeleteLeadsAction", () => {
    it("Admin can bulk delete multiple selected leads", async () => {
      const orgId = "org_del_test";
      const leadId1 = `lead_del_1_${Date.now()}`;
      const leadId2 = `lead_del_2_${Date.now()}`;

      mockLeadsStore.push(
        {
          id: leadId1,
          organizationId: orgId,
          leadNumber: "LEAD-D1",
          firstName: "Delete Lead",
          lastName: "One",
          fullName: "Delete Lead One",
          email: "del1@test.com",
          source: "Website",
          status: "New",
          rating: "Warm",
          estimatedValue: 15000,
          currency: "USD",
          ownerId: "usr_rep1",
          createdById: "usr_rep1",
          ownerName: "Rep 1",
          createdAt: new Date().toISOString(),
        },
        {
          id: leadId2,
          organizationId: orgId,
          leadNumber: "LEAD-D2",
          firstName: "Delete Lead",
          lastName: "Two",
          fullName: "Delete Lead Two",
          email: "del2@test.com",
          source: "Website",
          status: "New",
          rating: "Warm",
          estimatedValue: 25000,
          currency: "USD",
          ownerId: "usr_rep2",
          createdById: "usr_rep2",
          ownerName: "Rep 2",
          createdAt: new Date().toISOString(),
        }
      );

      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
        id: "usr_admin",
        email: "admin@company.com",
        name: "Admin User",
        organizationId: orgId,
        organizationName: "Test Org",
        role: "ADMIN",
        permissions: ["lead:delete"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await bulkDeleteLeadsAction([leadId1, leadId2]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(2);

      expect(mockLeadsStore.find((l) => l.id === leadId1)).toBeUndefined();
      expect(mockLeadsStore.find((l) => l.id === leadId2)).toBeUndefined();
    });

    it("Sales rep can only delete their own leads and cannot delete another rep's lead in bulk", async () => {
      const orgId = "org_scoped_del_test";
      const ownLeadId = `lead_own_${Date.now()}`;
      const otherLeadId = `lead_other_${Date.now()}`;

      mockLeadsStore.push(
        {
          id: ownLeadId,
          organizationId: orgId,
          leadNumber: "LEAD-OWN",
          firstName: "Own",
          lastName: "Lead",
          fullName: "Own Lead",
          email: "own@test.com",
          source: "Website",
          status: "New",
          rating: "Warm",
          estimatedValue: 5000,
          currency: "USD",
          ownerId: "usr_rep_own",
          createdById: "usr_rep_own",
          ownerName: "Rep Own",
          createdAt: new Date().toISOString(),
        },
        {
          id: otherLeadId,
          organizationId: orgId,
          leadNumber: "LEAD-OTHER",
          firstName: "Other",
          lastName: "Lead",
          fullName: "Other Lead",
          email: "other@test.com",
          source: "Website",
          status: "New",
          rating: "Warm",
          estimatedValue: 50000,
          currency: "USD",
          ownerId: "usr_rep_other",
          createdById: "usr_rep_other",
          ownerName: "Rep Other",
          createdAt: new Date().toISOString(),
        }
      );

      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
        id: "usr_rep_own",
        email: "repown@company.com",
        name: "Rep Own",
        organizationId: orgId,
        organizationName: "Test Org",
        role: "SALES_USER",
        permissions: ["lead:delete"],
        expiresAt: Date.now() + 3600000,
      });

      // Rep attempts to bulk delete both their own lead and other rep's lead
      const res = await bulkDeleteLeadsAction([ownLeadId, otherLeadId]);
      expect(res.success).toBe(true);
      expect(res.count).toBe(1); // Only own lead deleted

      // Own lead should be removed
      expect(mockLeadsStore.find((l) => l.id === ownLeadId)).toBeUndefined();
      // Other rep's lead must remain intact
      expect(mockLeadsStore.find((l) => l.id === otherLeadId)).toBeDefined();
    });

    it("Rejects when no lead IDs are provided", async () => {
      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
        id: "usr_admin",
        email: "admin@company.com",
        name: "Admin User",
        organizationId: "org_test",
        organizationName: "Test Org",
        role: "ADMIN",
        permissions: ["lead:delete"],
        expiresAt: Date.now() + 3600000,
      });

      const res = await bulkDeleteLeadsAction([]);
      expect(res.success).toBe(false);
      expect(res.error).toContain("No leads selected");
    });
  });
});
