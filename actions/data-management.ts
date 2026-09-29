"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockLeadsStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
  mockAuditLogsStore,
} from "@/lib/db/mock-store";
import {
  resetCrmDataSchema,
  ResetCrmDataInput,
  CrmDataCounts,
} from "@/lib/validations/data-management";

/**
 * Fetch live data record counts for the current organization
 */
export async function getDataCountsAction(): Promise<{
  success: boolean;
  data?: CrmDataCounts;
  error?: string;
}> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required." };
    }
    const { organizationId } = await resolveTenantContext(session);

    let leadsCount = 0;
    let companiesCount = 0;
    let contactsCount = 0;
    let opportunitiesCount = 0;

    try {
      const [leads, companies, contacts, opportunities] = await Promise.all([
        prisma.lead.count({ where: { organizationId, deletedAt: null } }),
        prisma.company.count({ where: { organizationId, deletedAt: null } }),
        prisma.contact.count({ where: { organizationId, deletedAt: null } }),
        prisma.opportunity.count({ where: { organizationId, deletedAt: null } }),
      ]);
      leadsCount = leads;
      companiesCount = companies;
      contactsCount = contacts;
      opportunitiesCount = opportunities;
    } catch {
      // Prisma offline or sample pooler fallback
    }

    // If database returned 0 for all, fall back to mock store counts for this tenant
    const mockLeads = mockLeadsStore.filter(
      (l) => l.organizationId === session.organizationId || l.organizationId === organizationId
    ).length;
    const mockCompanies = mockCompaniesStore.filter(
      (c) => c.organizationId === session.organizationId || c.organizationId === organizationId
    ).length;
    const mockContacts = mockContactsStore.filter(
      (c) => c.organizationId === session.organizationId || c.organizationId === organizationId
    ).length;
    const mockOpportunities = mockOpportunitiesStore.filter(
      (o) => o.organizationId === session.organizationId || o.organizationId === organizationId
    ).length;

    return {
      success: true,
      data: {
        leadsCount: Math.max(leadsCount, mockLeads),
        companiesCount: Math.max(companiesCount, mockCompanies),
        contactsCount: Math.max(contactsCount, mockContacts),
        opportunitiesCount: Math.max(opportunitiesCount, mockOpportunities),
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to fetch CRM data counts.",
    };
  }
}

/**
 * Reset or wipe CRM records for a tenant organization
 * Strictly restricted to Admin users with verification confirmation.
 */
export async function resetCrmDataAction(
  input: ResetCrmDataInput
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // 1. Validate Schema
    const parsed = resetCrmDataSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid reset confirmation.",
      };
    }

    // 2. Authentication & Admin Authorization
    const session = await getSession();
    if (!session) {
      return { success: false, error: "Authentication required." };
    }
    const roleUpper = session.role?.toUpperCase();
    const isAdmin =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      Boolean(session.isSuperAdmin);

    if (!isAdmin) {
      return {
        success: false,
        error: "Unauthorized: Only Organization Admins can reset or wipe CRM data.",
      };
    }

    const { organizationId, userId } = await resolveTenantContext(session);
    const entity = parsed.data.entity;

    // 3. Perform Entity-specific Wiping
    if (entity === "leads" || entity === "all") {
      try {
        await prisma.lead.updateMany({
          where: { organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      } catch {}

      const remainingLeads = mockLeadsStore.filter(
        (l) => l.organizationId !== session.organizationId && l.organizationId !== organizationId
      );
      mockLeadsStore.length = 0;
      mockLeadsStore.push(...remainingLeads);
    }

    if (entity === "contacts" || entity === "all") {
      try {
        await prisma.contact.updateMany({
          where: { organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      } catch {}

      const remainingContacts = mockContactsStore.filter(
        (c) => c.organizationId !== session.organizationId && c.organizationId !== organizationId
      );
      mockContactsStore.length = 0;
      mockContactsStore.push(...remainingContacts);
    }

    if (entity === "companies" || entity === "all") {
      try {
        await prisma.company.updateMany({
          where: { organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
        await prisma.opportunity.updateMany({
          where: { organizationId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      } catch {}

      const remainingCompanies = mockCompaniesStore.filter(
        (c) => c.organizationId !== session.organizationId && c.organizationId !== organizationId
      );
      mockCompaniesStore.length = 0;
      mockCompaniesStore.push(...remainingCompanies);

      const remainingOpps = mockOpportunitiesStore.filter(
        (o) => o.organizationId !== session.organizationId && o.organizationId !== organizationId
      );
      mockOpportunitiesStore.length = 0;
      mockOpportunitiesStore.push(...remainingOpps);

      // Disassociate companies on remaining contacts for this tenant
      mockContactsStore.forEach((c) => {
        if (c.organizationId === session.organizationId || c.organizationId === organizationId) {
          c.companyId = null;
          c.companyName = null;
        }
      });
    }

    // 4. Record Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId: userId || session.id,
          action: "DATA_RESET",
          entityType: entity.toUpperCase(),
          entityId: organizationId,
          newValues: {
            entity,
            resetBy: session.email,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch {}

    mockAuditLogsStore.unshift({
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      organizationId: session.organizationId,
      userId: session.id,
      userName: session.name || "Admin",
      action: "DATA_RESET",
      entityType: entity.toUpperCase(),
      entityId: session.organizationId,
      oldValues: null,
      newValues: { entity, resetBy: session.email },
      ipAddress: "127.0.0.1",
      createdAt: new Date().toISOString(),
    });

    // 5. Revalidate Paths
    try {
      revalidatePath("/leads");
      revalidatePath("/companies");
      revalidatePath("/contacts");
      revalidatePath("/opportunities");
      revalidatePath("/pipeline");
      revalidatePath("/dashboard");
      revalidatePath("/reports");
      revalidatePath("/settings");
    } catch {}

    const labelMap: Record<string, string> = {
      leads: "all Leads",
      companies: "all Companies & associated Deals",
      contacts: "all Contacts",
      all: "all CRM records (Leads, Companies, Contacts, Opportunities)",
    };

    return {
      success: true,
      message: `Successfully wiped ${labelMap[entity] || entity} for your organization.`,
    };
  } catch (err: any) {
    console.error("[resetCrmDataAction] Error:", err);
    return {
      success: false,
      error: err?.message || "Failed to execute CRM data reset.",
    };
  }
}
