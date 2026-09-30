import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getCompaniesAction,
  getCompanyByIdAction,
  assignCompanyAction,
} from "@/actions/companies";
import {
  getContactsAction,
  getContactByIdAction,
  assignContactAction,
} from "@/actions/contacts";
import { convertLeadAction } from "@/actions/lead-conversion";
import { importCsvAction } from "@/actions/imports";
import {
  mockCompaniesStore,
  mockContactsStore,
  mockLeadsStore,
} from "@/lib/db/mock-store";
import * as sessionModule from "@/lib/auth/session";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Company & Contact Role-Based Scoping, Ownership and Assignment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Company Visibility Scoping & Direct Access Protection", () => {
    it("sales rep only sees their own companies and cannot view another rep's company", async () => {
      const compRep1Id = `comp_rep1_${Date.now()}`;
      const compRep2Id = `comp_rep2_${Date.now()}`;

      mockCompaniesStore.unshift(
        {
          id: compRep1Id,
          organizationId: "demo-org-123",
          name: "Rep1 Alpha Corp",
          industry: "Tech",
          status: "Active",
          ownerId: "usr_rep1",
          ownerName: "Sales Rep 1",
          createdAt: new Date().toISOString(),
          contactCount: 0,
        },
        {
          id: compRep2Id,
          organizationId: "demo-org-123",
          name: "Rep2 Beta LLC",
          industry: "Finance",
          status: "Active",
          ownerId: "usr_rep2",
          ownerName: "Sales Rep 2",
          createdAt: new Date().toISOString(),
          contactCount: 0,
        }
      );

      // Authenticate as Sales Rep 1
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx.local",
        name: "Sales Rep 1",
        role: "SALES_USER",
        permissions: ["company:read", "company:create", "company:update"],
        expiresAt: Date.now() + 3600000,
      });

      // 1. List scoping
      const rep1Companies = await getCompaniesAction({ limit: 50 });
      expect(rep1Companies.success).toBe(true);
      const items = rep1Companies.data?.items || [];
      expect(items.some((c) => c.id === compRep1Id)).toBe(true);
      expect(items.some((c) => c.id === compRep2Id)).toBe(false);

      // 2. Direct ID access to own company
      const ownComp = await getCompanyByIdAction(compRep1Id);
      expect(ownComp.success).toBe(true);

      // 3. Direct ID access to other rep's company must fail with Unauthorized
      const otherComp = await getCompanyByIdAction(compRep2Id);
      expect(otherComp.success).toBe(false);
      expect(otherComp.error).toContain("Unauthorized");

      // Authenticate as Admin: should see both
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx.local",
        name: "Org Admin",
        role: "ADMIN",
        permissions: ["company:read", "company:create", "company:update", "company:delete"],
        expiresAt: Date.now() + 3600000,
      });

      const adminCompanies = await getCompaniesAction({ limit: 50 });
      expect(adminCompanies.success).toBe(true);
      const adminItems = adminCompanies.data?.items || [];
      expect(adminItems.some((c) => c.id === compRep1Id)).toBe(true);
      expect(adminItems.some((c) => c.id === compRep2Id)).toBe(true);

      const adminAccessOther = await getCompanyByIdAction(compRep2Id);
      expect(adminAccessOther.success).toBe(true);
    });

    it("sales rep cannot reassign company, but admin can", async () => {
      const compId = `comp_assign_${Date.now()}`;
      mockCompaniesStore.unshift({
        id: compId,
        organizationId: "demo-org-123",
        name: "Assign Test Corp",
        status: "Prospect",
        ownerId: "usr_rep1",
        ownerName: "Sales Rep 1",
        createdAt: new Date().toISOString(),
        contactCount: 0,
      });

      // Sales Rep attempts to reassign
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx.local",
        name: "Sales Rep 1",
        role: "SALES_USER",
        permissions: ["company:update"],
        expiresAt: Date.now() + 3600000,
      });

      const repAssign = await assignCompanyAction(compId, "usr_rep2");
      expect(repAssign.success).toBe(false);
      expect(repAssign.error).toContain("Unauthorized");

      // Admin attempts to reassign
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx.local",
        name: "Org Admin",
        role: "ADMIN",
        permissions: ["company:update"],
        expiresAt: Date.now() + 3600000,
      });

      const adminAssign = await assignCompanyAction(compId, "usr_rep2");
      expect(adminAssign.success).toBe(true);

      const updated = mockCompaniesStore.find((c) => c.id === compId);
      expect(updated?.ownerId).toBe("usr_rep2");
    });
  });

  describe("2. Contact Visibility Scoping & Direct Access Protection", () => {
    it("sales rep only sees their own contacts and cannot view another rep's contact", async () => {
      const contactRep1Id = `cont_rep1_${Date.now()}`;
      const contactRep2Id = `cont_rep2_${Date.now()}`;

      mockContactsStore.unshift(
        {
          id: contactRep1Id,
          organizationId: "demo-org-123",
          firstName: "John",
          lastName: "Rep1",
          fullName: "John Rep1",
          email: "john@rep1.com",
          ownerId: "usr_rep1",
          ownerName: "Sales Rep 1",
          createdAt: new Date().toISOString(),
        },
        {
          id: contactRep2Id,
          organizationId: "demo-org-123",
          firstName: "Jane",
          lastName: "Rep2",
          fullName: "Jane Rep2",
          email: "jane@rep2.com",
          ownerId: "usr_rep2",
          ownerName: "Sales Rep 2",
          createdAt: new Date().toISOString(),
        }
      );

      // Authenticate as Sales Rep 1
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx.local",
        name: "Sales Rep 1",
        role: "SALES_USER",
        permissions: ["contact:read", "contact:create", "contact:update"],
        expiresAt: Date.now() + 3600000,
      });

      // 1. List scoping
      const rep1Contacts = await getContactsAction({ limit: 50 });
      expect(rep1Contacts.success).toBe(true);
      const items = rep1Contacts.data?.items || [];
      expect(items.some((c) => c.id === contactRep1Id)).toBe(true);
      expect(items.some((c) => c.id === contactRep2Id)).toBe(false);

      // 2. Direct ID access to own contact
      const ownCont = await getContactByIdAction(contactRep1Id);
      expect(ownCont.success).toBe(true);

      // 3. Direct ID access to other rep's contact must fail
      const otherCont = await getContactByIdAction(contactRep2Id);
      expect(otherCont.success).toBe(false);
      expect(otherCont.error).toContain("Unauthorized");

      // Authenticate as Manager: should see both
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_manager",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "manager@roxx.local",
        name: "Sales Manager",
        role: "MANAGER",
        permissions: ["contact:read", "contact:create", "contact:update", "contact:delete"],
        expiresAt: Date.now() + 3600000,
      });

      const managerContacts = await getContactsAction({ limit: 50 });
      expect(managerContacts.success).toBe(true);
      const managerItems = managerContacts.data?.items || [];
      expect(managerItems.some((c) => c.id === contactRep1Id)).toBe(true);
      expect(managerItems.some((c) => c.id === contactRep2Id)).toBe(true);

      const managerAccessOther = await getContactByIdAction(contactRep2Id);
      expect(managerAccessOther.success).toBe(true);
    });

    it("sales rep cannot reassign contact, but manager/admin can", async () => {
      const contactId = `cont_assign_${Date.now()}`;
      mockContactsStore.unshift({
        id: contactId,
        organizationId: "demo-org-123",
        firstName: "Alice",
        lastName: "Smith",
        fullName: "Alice Smith",
        email: "alice@test.com",
        ownerId: "usr_rep1",
        ownerName: "Sales Rep 1",
        createdAt: new Date().toISOString(),
      });

      // Sales rep attempt
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx.local",
        name: "Sales Rep 1",
        role: "SALES_USER",
        permissions: ["contact:update"],
        expiresAt: Date.now() + 3600000,
      });

      const repAssign = await assignContactAction(contactId, "usr_rep2");
      expect(repAssign.success).toBe(false);
      expect(repAssign.error).toContain("Unauthorized");

      // Manager attempt
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_manager",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "mgr@roxx.local",
        name: "Sales Manager",
        role: "MANAGER",
        permissions: ["contact:update"],
        expiresAt: Date.now() + 3600000,
      });

      const mgrAssign = await assignContactAction(contactId, "usr_rep2");
      expect(mgrAssign.success).toBe(true);

      const updated = mockContactsStore.find((c) => c.id === contactId);
      expect(updated?.ownerId).toBe("usr_rep2");
    });
  });

  describe("3. Lead Conversion and Imports Owner Scoping", () => {
    it("lead conversion assigns company and contact to the lead owner", async () => {
      const leadId = `lead_conv_test_${Date.now()}`;
      mockLeadsStore.unshift({
        id: leadId,
        organizationId: "demo-org-123",
        leadNumber: "LEAD-CONV-1",
        firstName: "Convert",
        lastName: "Candidate",
        fullName: "Convert Candidate",
        email: "candidate@corp.com",
        phone: "555-1234",
        companyName: "Conversion Target Inc",
        source: "Inbound",
        status: "Qualified",
        rating: "Hot",
        estimatedValue: 20000,
        currency: "USD",
        ownerId: "usr_rep1",
        ownerName: "Sales Rep 1",
        createdById: "usr_rep1",
        createdAt: new Date().toISOString(),
      });

      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
        id: "usr_admin",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "admin@roxx.local",
        name: "Admin User",
        role: "ADMIN",
        permissions: ["lead:update", "company:create", "contact:create"],
        expiresAt: Date.now() + 3600000,
      });

      const conversionRes = await convertLeadAction(leadId, {
        companyMode: "NEW",
        companyName: "Conversion Target Inc",
        contactFirstName: "Convert",
        contactLastName: "Candidate",
        contactEmail: "candidate@corp.com",
        contactPhone: "555-1234",
        createOpportunity: true,
        opportunityName: "Conversion Opportunity",
        opportunityAmount: 20000,
        opportunityStage: "Qualified",
      });

      expect(conversionRes.success).toBe(true);
      const companyId = conversionRes.data?.companyId;
      const contactId = conversionRes.data?.contactId;

      const createdCompany = mockCompaniesStore.find((c) => c.id === companyId);
      const createdContact = mockContactsStore.find((c) => c.id === contactId);

      // Ownership of Company and Contact must match the original lead's owner
      expect(createdCompany?.ownerId).toBe("usr_rep1");
      expect(createdContact?.ownerId).toBe("usr_rep1");
    });

    it("csv import tags imported companies and contacts with the current user's ownerId", async () => {
      vi.spyOn(sessionModule, "requireAuth").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx.local",
        name: "Sales Rep 1",
        role: "SALES_USER",
        permissions: ["company:create", "contact:create"],
        expiresAt: Date.now() + 3600000,
      });

      vi.spyOn(sessionModule, "requirePermission").mockResolvedValue({
        id: "usr_rep1",
        organizationId: "demo-org-123",
        organizationName: "Demo Company",
        email: "rep1@roxx.local",
        name: "Sales Rep 1",
        role: "SALES_USER",
        permissions: ["company:create", "contact:create"],
        expiresAt: Date.now() + 3600000,
      });

      const companyCsv = "Name,Industry,City\nImported Corp,Tech,San Francisco";
      const compRes = await importCsvAction("companies", companyCsv);
      expect(compRes.success).toBe(true);
      expect(compRes.data?.importedCount).toBe(1);

      const importedComp = mockCompaniesStore.find((c) => c.name === "Imported Corp");
      expect(importedComp?.ownerId).toBe("usr_rep1");

      const contactCsv = "First Name,Last Name,Email\nImported,Person,imported@person.com";
      const contRes = await importCsvAction("contacts", contactCsv);
      expect(contRes.success).toBe(true);
      expect(contRes.data?.importedCount).toBe(1);

      const importedContact = mockContactsStore.find((c) => c.email === "imported@person.com");
      expect(importedContact?.ownerId).toBe("usr_rep1");
    });
  });
});
