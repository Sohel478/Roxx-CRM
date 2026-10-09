import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  mockMarketingBatchesStore,
  mockMarketingCampaignsStore,
  mockLeadsStore,
  mockSmtpStore,
  mockActivitiesStore,
} from "@/lib/db/mock-store";
import { encryptSecret } from "@/lib/crypto/encryption";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let mockSessionUser: any = {
  id: "usr_rep_1",
  organizationId: "org_marketing_test",
  organizationName: "Marketing Test Org",
  email: "alex@roxx-crm.com",
  name: "Alex Sales",
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
    if (opts.to === "fail@example.com") {
      return { success: false, error: "Mailbox unavailable" };
    }
    return { success: true, messageId: `msg_${Date.now()}` };
  }),
}));

import {
  getMarketingBatchesAction,
  getMarketingBatchByIdAction,
  createMarketingBatchAction,
  updateMarketingBatchAction,
  deleteMarketingBatchAction,
  sendBatchEmailAction,
  getSelectableLeadsForBatchAction,
  removeLeadsFromMarketingBatchAction,
} from "@/actions/marketing";

describe("Marketing Module: Lead Batches & Bulk Email Campaigns", () => {
  beforeEach(() => {
    mockMarketingBatchesStore.length = 0;
    mockMarketingCampaignsStore.length = 0;
    mockLeadsStore.length = 0;
    mockActivitiesStore.length = 0;

    // Seed test leads
    mockLeadsStore.push(
      {
        id: "lead_101",
        organizationId: "org_marketing_test",
        leadNumber: "LEAD-101",
        firstName: "Alice",
        lastName: "Wonder",
        fullName: "Alice Wonder",
        email: "alice@wonderland.com",
        supportEmail: null,
        phone: "+1 555-0101",
        companyName: "Wonder Corp",
        jobTitle: "CEO",
        source: "Website",
        status: "Qualified",
        rating: "Hot",
        estimatedValue: 40000,
        currency: "USD",
        ownerId: "usr_rep_1",
        ownerName: "Alex Sales",
        createdById: "usr_rep_1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "lead_102",
        organizationId: "org_marketing_test",
        leadNumber: "LEAD-102",
        firstName: "Bob",
        lastName: "Builder",
        fullName: "Bob Builder",
        email: "bob@builder.com",
        supportEmail: null,
        phone: "+1 555-0102",
        companyName: "Builder Industries",
        jobTitle: "Founder",
        source: "Referral",
        status: "New",
        rating: "Warm",
        estimatedValue: 20000,
        currency: "USD",
        ownerId: "usr_rep_1",
        ownerName: "Alex Sales",
        createdById: "usr_rep_1",
        createdAt: new Date().toISOString(),
      },
      {
        id: "lead_103",
        organizationId: "org_marketing_test",
        leadNumber: "LEAD-103",
        firstName: "Charlie",
        lastName: "NoEmail",
        fullName: "Charlie NoEmail",
        email: null,
        supportEmail: null,
        phone: "+1 555-0103",
        companyName: "Silent Tech",
        jobTitle: "Director",
        source: "Scraped Import",
        status: "Contacted",
        rating: "Cold",
        estimatedValue: 5000,
        currency: "USD",
        ownerId: "usr_rep_1",
        ownerName: "Alex Sales",
        createdById: "usr_rep_1",
        createdAt: new Date().toISOString(),
      }
    );

    // Reset session user to Sales Rep 1
    mockSessionUser = {
      id: "usr_rep_1",
      organizationId: "org_marketing_test",
      organizationName: "Marketing Test Org",
      email: "alex@roxx-crm.com",
      name: "Alex Sales",
      role: "SALES_REP",
      permissions: ["activity:create", "lead:create"],
    };
  });

  describe("Batch Creation & Validation", () => {
    it("successfully creates a marketing batch with selected leads", async () => {
      const res = await createMarketingBatchAction({
        name: "New Year Email",
        description: "Holiday campaign for active prospects",
        leadIds: ["lead_101", "lead_102"],
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.name).toBe("New Year Email");
      expect(res.data?.leadCount).toBe(2);
      expect(res.data?.ownerId).toBe("usr_rep_1");

      expect(mockMarketingBatchesStore.length).toBe(1);
      expect(mockMarketingBatchesStore[0].name).toBe("New Year Email");
    });

    it("rejects batch creation if name is empty", async () => {
      const res = await createMarketingBatchAction({
        name: "",
        leadIds: ["lead_101"],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("Batch name is required");
    });

    it("rejects batch creation if no leads are selected", async () => {
      const res = await createMarketingBatchAction({
        name: "Empty Batch",
        leadIds: [],
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("At least one lead must be selected");
    });
  });

  describe("Role-Based Visibility & Access Controls", () => {
    beforeEach(async () => {
      // Create batch owned by usr_rep_1
      await createMarketingBatchAction({
        name: "Rep 1 Batch",
        leadIds: ["lead_101"],
      });

      // Switch to usr_rep_2 and create a batch
      mockSessionUser = {
        id: "usr_rep_2",
        organizationId: "org_marketing_test",
        organizationName: "Marketing Test Org",
        email: "emma@roxx-crm.com",
        name: "Emma Sales",
        role: "SALES_REP",
        permissions: ["activity:create", "lead:create"],
      };

      await createMarketingBatchAction({
        name: "Rep 2 Batch",
        leadIds: ["lead_102"],
      });
    });

    it("restricts Sales Reps to viewing only their own batches", async () => {
      // As usr_rep_2
      const res = await getMarketingBatchesAction();
      expect(res.success).toBe(true);
      expect(res.data?.batches.length).toBe(1);
      expect(res.data?.batches[0].name).toBe("Rep 2 Batch");

      // Switch back to usr_rep_1
      mockSessionUser.id = "usr_rep_1";
      mockSessionUser.name = "Alex Sales";
      const rep1Res = await getMarketingBatchesAction();
      expect(rep1Res.success).toBe(true);
      expect(rep1Res.data?.batches.length).toBe(1);
      expect(rep1Res.data?.batches[0].name).toBe("Rep 1 Batch");
    });

    it("allows Admins to view all batches across the organization for logs and oversight", async () => {
      mockSessionUser = {
        id: "usr_admin",
        organizationId: "org_marketing_test",
        organizationName: "Marketing Test Org",
        email: "admin@roxx-crm.com",
        name: "Admin Boss",
        role: "ADMIN",
        permissions: ["*"],
      };

      const res = await getMarketingBatchesAction();
      expect(res.success).toBe(true);
      expect(res.data?.batches.length).toBe(2);
      const names = res.data?.batches.map((b) => b.name);
      expect(names).toContain("Rep 1 Batch");
      expect(names).toContain("Rep 2 Batch");
    });

    it("prevents a Sales Rep from viewing another rep's batch details", async () => {
      const rep1Batch = mockMarketingBatchesStore.find((b) => b.name === "Rep 1 Batch");
      expect(rep1Batch).toBeDefined();

      // Log in as usr_rep_2
      mockSessionUser = {
        id: "usr_rep_2",
        organizationId: "org_marketing_test",
        role: "SALES_REP",
      };

      const res = await getMarketingBatchByIdAction(rep1Batch!.id);
      expect(res.success).toBe(false);
      expect(res.error).toContain("Unauthorized");
    });
  });

  describe("Batch Update & Delete", () => {
    it("allows batch owner to update name and leads", async () => {
      const created = await createMarketingBatchAction({
        name: "Original Name",
        leadIds: ["lead_101"],
      });
      const batchId = created.data!.id;

      const updateRes = await updateMarketingBatchAction({
        id: batchId,
        name: "Updated Name",
        description: "New description",
        leadIds: ["lead_101", "lead_102"],
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.name).toBe("Updated Name");
      expect(updateRes.data?.leadCount).toBe(2);
    });

    it("soft-deletes a batch cleanly", async () => {
      const created = await createMarketingBatchAction({
        name: "To Delete",
        leadIds: ["lead_101"],
      });
      const batchId = created.data!.id;

      const deleteRes = await deleteMarketingBatchAction(batchId);
      expect(deleteRes.success).toBe(true);

      const listRes = await getMarketingBatchesAction();
      expect(listRes.data?.batches.find((b) => b.id === batchId)).toBeUndefined();
    });
  });

  describe("Bulk Email Dispatch & Campaign Logging", () => {
    it("fails if SMTP is not configured for the organization", async () => {
      // Make sure SMTP store is empty for org
      delete mockSmtpStore["org_marketing_test"];

      const created = await createMarketingBatchAction({
        name: "Outreach 1",
        leadIds: ["lead_101"],
      });

      const res = await sendBatchEmailAction({
        batchId: created.data!.id,
        subject: "Hello {{first_name}}",
        body: "Check this out",
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain("SMTP is not configured");
    });

    it("dispatches personalized bulk emails with merge tags and logs touchpoints", async () => {
      // Configure mock SMTP
      mockSmtpStore["org_marketing_test"] = {
        organizationId: "org_marketing_test",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        username: "smtp@roxx-crm.com",
        encryptedPassword: encryptSecret("supersecretpass"),
        fromName: "Marketing Team",
        fromEmail: "sales@roxx-crm.com",
        updatedAt: new Date().toISOString(),
      };

      // Create batch with 3 leads: Alice (has email), Bob (has email), Charlie (NO email)
      const created = await createMarketingBatchAction({
        name: "New Year Email",
        leadIds: ["lead_101", "lead_102", "lead_103"],
      });
      const batchId = created.data!.id;

      const sendRes = await sendBatchEmailAction({
        batchId,
        subject: "Happy New Year {{first_name}} from {{rep_name}}!",
        body: "Hi {{first_name}}, we are excited to work with {{company_name}}!",
      });

      expect(sendRes.success).toBe(true);
      expect(sendRes.data).toBeDefined();

      const camp = sendRes.data!;
      expect(camp.totalRecipients).toBe(3);
      expect(camp.sentCount).toBe(2); // Alice & Bob
      expect(camp.failedCount).toBe(1); // Charlie skipped due to missing email

      // Verify recipient logs
      const aliceLog = camp.recipientLogs.find((l) => l.leadName === "Alice Wonder");
      expect(aliceLog?.status).toBe("SENT");
      expect(aliceLog?.email).toBe("alice@wonderland.com");

      const charlieLog = camp.recipientLogs.find((l) => l.leadName === "Charlie NoEmail");
      expect(charlieLog?.status).toBe("SKIPPED");
      expect(charlieLog?.error).toContain("Missing or invalid email");

      // Verify campaign is saved in mock store
      expect(mockMarketingCampaignsStore.length).toBe(1);
      expect(mockMarketingCampaignsStore[0].id).toBe(camp.id);

      // Verify activity logs recorded
      const emailActivities = mockActivitiesStore.filter((a) => a.type === "EMAIL");
      expect(emailActivities.length).toBeGreaterThanOrEqual(2);
      expect(emailActivities.some((a) => a.leadId === "lead_101")).toBe(true);
      expect(emailActivities.some((a) => a.leadId === "lead_102")).toBe(true);
    });
  });

  describe("Selectable Leads Fetching", () => {
    it("returns available leads filtered by user query", async () => {
      const res = await getSelectableLeadsForBatchAction({ search: "Alice" });
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(1);
      expect(res.data![0].fullName).toBe("Alice Wonder");
    });
  });

  describe("Removing Leads from Marketing Batch (Safe Unlinking)", () => {
    it("successfully unlinks a single lead from batch without deleting it from CRM", async () => {
      const created = await createMarketingBatchAction({
        name: "Spring Outreach",
        leadIds: ["lead_101", "lead_102", "lead_103"],
      });
      const batchId = created.data!.id;

      // Remove single lead: lead_102
      const removeRes = await removeLeadsFromMarketingBatchAction({
        batchId,
        leadIds: ["lead_102"],
      });

      expect(removeRes.success).toBe(true);
      expect(removeRes.leadCount).toBe(2);

      // Verify batch in store
      const batchInStore = mockMarketingBatchesStore.find((b) => b.id === batchId);
      expect(batchInStore?.leadIds).toEqual(["lead_101", "lead_103"]);
      expect(batchInStore?.leadCount).toBe(2);

      // Verify the lead still exists in CRM database
      const lead102InCrm = mockLeadsStore.find((l) => l.id === "lead_102");
      expect(lead102InCrm).toBeDefined();
      expect(lead102InCrm?.firstName).toBe("Bob");

      // Verify batch detail query reflects the removal
      const detailRes = await getMarketingBatchByIdAction(batchId);
      expect(detailRes.success).toBe(true);
      expect(detailRes.data?.leads.length).toBe(2);
      expect(detailRes.data?.leads.map((l) => l.id)).toEqual(["lead_101", "lead_103"]);
    });

    it("successfully removes multiple leads in bulk", async () => {
      const created = await createMarketingBatchAction({
        name: "Bulk Unlink Test",
        leadIds: ["lead_101", "lead_102", "lead_103"],
      });
      const batchId = created.data!.id;

      // Bulk remove: lead_101 and lead_103
      const removeRes = await removeLeadsFromMarketingBatchAction({
        batchId,
        leadIds: ["lead_101", "lead_103"],
      });

      expect(removeRes.success).toBe(true);
      expect(removeRes.leadCount).toBe(1);

      const batchInStore = mockMarketingBatchesStore.find((b) => b.id === batchId);
      expect(batchInStore?.leadIds).toEqual(["lead_102"]);
      expect(batchInStore?.leadCount).toBe(1);

      // All leads still exist in CRM leads
      expect(mockLeadsStore.length).toBe(3);
    });

    it("prevents unauthorized users from removing leads from a batch", async () => {
      const created = await createMarketingBatchAction({
        name: "Alex Private Batch",
        leadIds: ["lead_101", "lead_102"],
      });
      const batchId = created.data!.id;

      // Switch session to another rep who does not own the batch
      mockSessionUser = {
        id: "usr_rep_stranger",
        organizationId: "org_marketing_test",
        email: "stranger@roxx-crm.com",
        name: "Stranger Rep",
        role: "SALES_REP",
        permissions: ["activity:create", "lead:create"],
      };

      const removeRes = await removeLeadsFromMarketingBatchAction({
        batchId,
        leadIds: ["lead_101"],
      });

      expect(removeRes.success).toBe(false);
      expect(removeRes.error).toContain("Unauthorized");

      // Batch remains unchanged
      const batchInStore = mockMarketingBatchesStore.find((b) => b.id === batchId);
      expect(batchInStore?.leadIds.length).toBe(2);
    });
  });
});
