"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import {
  mockLeadsStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
} from "@/lib/db/mock-store";
import {
  leadSchema,
  LeadFormData,
  LeadItem,
} from "@/lib/validations/leads";

export type { LeadItem, LeadFormData };

/**
 * Check if a lead with matching email or normalized phone already exists
 */
export async function checkLeadDuplicateAction(params: {
  email?: string;
  phone?: string;
  excludeId?: string;
}) {
  const session = await requireAuth();
  const cleanEmail = params.email?.trim().toLowerCase();
  const cleanPhone = params.phone?.replace(/[^0-9]/g, "");

  if (!cleanEmail && !cleanPhone) {
    return { isDuplicate: false };
  }

  try {
    const existing = await prisma.lead.findFirst({
      where: {
        organizationId: session.organizationId,
        deletedAt: null,
        id: params.excludeId ? { not: params.excludeId } : undefined,
        OR: [
          cleanEmail ? { email: { equals: cleanEmail, mode: "insensitive" } } : undefined,
          cleanPhone ? { phone: { contains: cleanPhone } } : undefined,
        ].filter(Boolean) as any,
      },
      select: { id: true, firstName: true, lastName: true, companyName: true, leadNumber: true },
    });

    if (existing) {
      return {
        isDuplicate: true,
        match: {
          id: existing.id,
          name: `${existing.firstName} ${existing.lastName || ""}`.trim(),
          companyName: existing.companyName,
          leadNumber: existing.leadNumber,
        },
      };
    }
  } catch {
    // In-memory check
    const match = mockLeadsStore.find((l) => {
      if (params.excludeId && l.id === params.excludeId) return false;
      const matchEmail = cleanEmail && l.email && l.email.toLowerCase() === cleanEmail;
      const matchPhone = cleanPhone && l.phone && l.phone.replace(/[^0-9]/g, "").includes(cleanPhone);
      return matchEmail || matchPhone;
    });

    if (match) {
      return {
        isDuplicate: true,
        match: {
          id: match.id,
          name: match.fullName,
          companyName: match.companyName,
          leadNumber: match.leadNumber,
        },
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Fetch paginated leads
 */
export async function getLeadsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  rating?: string;
}) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (params.status && params.status !== "ALL") {
      where.status = params.status;
    }
    if (params.source && params.source !== "ALL") {
      where.source = params.source;
    }
    if (params.rating && params.rating !== "ALL") {
      where.rating = params.rating;
    }

    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { companyName: { contains: params.search, mode: "insensitive" } },
        { leadNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          owner: { select: { name: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((l) => ({
          id: l.id,
          leadNumber: l.leadNumber || `LEAD-${l.id.slice(-4).toUpperCase()}`,
          firstName: l.firstName,
          lastName: l.lastName,
          fullName: `${l.firstName} ${l.lastName || ""}`.trim(),
          email: l.email,
          phone: l.phone,
          companyName: l.companyName,
          jobTitle: l.jobTitle,
          source: l.source,
          status: l.status,
          rating: l.rating || "Warm",
          estimatedValue: Number(l.estimatedValue || 0),
          currency: l.currency,
          description: l.description,
          ownerName: l.owner?.name || null,
          createdAt: l.createdAt.toISOString(),
        })),
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    };
  } catch {
    // In-memory fallback
    let filtered = mockLeadsStore.filter((l) => {
      const matchesSearch =
        !params.search ||
        l.fullName.toLowerCase().includes(params.search.toLowerCase()) ||
        (l.email && l.email.toLowerCase().includes(params.search.toLowerCase())) ||
        (l.companyName && l.companyName.toLowerCase().includes(params.search.toLowerCase())) ||
        (l.leadNumber && l.leadNumber.toLowerCase().includes(params.search.toLowerCase()));

      const matchesStatus = !params.status || params.status === "ALL" || l.status === params.status;
      const matchesSource = !params.source || params.source === "ALL" || l.source === params.source;
      const matchesRating = !params.rating || params.rating === "ALL" || l.rating === params.rating;

      return matchesSearch && matchesStatus && matchesSource && matchesRating;
    });

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      success: true,
      data: {
        items: paginated,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    };
  }
}

/**
 * Get lead detail by ID
 */
export async function getLeadByIdAction(id: string) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);

  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId,
        deletedAt: null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        activities: {
          orderBy: { activityAt: "desc" },
          take: 10,
        },
        tasks: {
          orderBy: { dueAt: "asc" },
        },
        notes: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) {
      const mock = mockLeadsStore.find((l) => l.id === id);
      if (mock) {
        let convertedInfo = null;
        if (mock.convertedCompanyId || mock.convertedAt) {
          const comp = mockCompaniesStore.find((c) => c.id === mock.convertedCompanyId);
          const cont = mockContactsStore.find((ct) => ct.id === mock.convertedContactId);
          const opp = mockOpportunitiesStore.find((o) => o.id === mock.convertedOpportunityId);
          convertedInfo = {
            companyId: mock.convertedCompanyId,
            companyName: comp?.name || mock.companyName || "Company",
            contactId: mock.convertedContactId,
            contactName: cont?.fullName || mock.fullName,
            opportunityId: mock.convertedOpportunityId || null,
            opportunityName: opp?.name || null,
            opportunityAmount: opp?.amount || null,
          };
        }

        return {
          success: true,
          data: {
            ...mock,
            convertedInfo,
            owner: { id: "usr_alex", name: mock.ownerName || "Alex Sales" },
            activities: [],
            tasks: [],
            notes: [],
          },
        };
      }
      return { success: false, error: "Lead not found" };
    }

    let convertedInfo = null;
    if (lead.convertedCompanyId || lead.convertedAt) {
      let companyName = null;
      let contactName = null;
      let opportunityName = null;
      let opportunityAmount = null;

      if (lead.convertedCompanyId) {
        const comp = await prisma.company.findUnique({
          where: { id: lead.convertedCompanyId },
          select: { name: true },
        });
        companyName = comp?.name || null;
      }
      if (lead.convertedContactId) {
        const ct = await prisma.contact.findUnique({
          where: { id: lead.convertedContactId },
          select: { firstName: true, lastName: true },
        });
        contactName = ct ? `${ct.firstName} ${ct.lastName || ""}`.trim() : null;
      }
      if (lead.convertedOpportunityId) {
        const opp = await prisma.opportunity.findUnique({
          where: { id: lead.convertedOpportunityId },
          select: { name: true, amount: true },
        });
        opportunityName = opp?.name || null;
        opportunityAmount = opp ? Number(opp.amount) : null;
      }

      convertedInfo = {
        companyId: lead.convertedCompanyId,
        companyName: companyName || lead.companyName || "Company",
        contactId: lead.convertedContactId,
        contactName: contactName || `${lead.firstName} ${lead.lastName || ""}`.trim(),
        opportunityId: lead.convertedOpportunityId,
        opportunityName,
        opportunityAmount,
      };
    }

    return {
      success: true,
      data: {
        ...lead,
        convertedInfo,
        estimatedValue: Number(lead.estimatedValue || 0),
        fullName: `${lead.firstName} ${lead.lastName || ""}`.trim(),
      },
    };
  } catch (err) {
    console.error("[getLeadByIdAction] Database error:", err);
    const mock = mockLeadsStore.find((l) => l.id === id);
    if (mock) {
      let convertedInfo = null;
      if (mock.convertedCompanyId || mock.convertedAt) {
        const comp = mockCompaniesStore.find((c) => c.id === mock.convertedCompanyId);
        const cont = mockContactsStore.find((ct) => ct.id === mock.convertedContactId);
        const opp = mockOpportunitiesStore.find((o) => o.id === mock.convertedOpportunityId);
        convertedInfo = {
          companyId: mock.convertedCompanyId,
          companyName: comp?.name || mock.companyName || "Company",
          contactId: mock.convertedContactId,
          contactName: cont?.fullName || mock.fullName,
          opportunityId: mock.convertedOpportunityId || null,
          opportunityName: opp?.name || null,
          opportunityAmount: opp?.amount || null,
        };
      }

      return {
        success: true,
        data: {
          ...mock,
          convertedInfo,
          owner: { id: "usr_alex", name: mock.ownerName || "Alex Sales" },
          activities: [],
          tasks: [],
          notes: [],
        },
      };
    }
    return { success: false, error: "Lead not found" };
  }
}

/**
 * Create a new lead
 */
export async function createLeadAction(data: LeadFormData) {
  const session = await requirePermission("lead:create");
  const { organizationId, userId } = await resolveTenantContext(session);
  const parsed = leadSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const {
    firstName,
    lastName,
    email,
    phone,
    companyName,
    jobTitle,
    source,
    sourceDetail,
    status,
    rating,
    estimatedValue,
    currency,
    description,
  } = parsed.data;

  const leadNumber = `LEAD-${Math.floor(1000 + Math.random() * 9000)}`;

  try {
    const created = await prisma.lead.create({
      data: {
        organizationId,
        leadNumber,
        firstName,
        lastName: lastName || null,
        email: email || null,
        phone: phone || null,
        companyName: companyName || null,
        jobTitle: jobTitle || null,
        source,
        sourceDetail: sourceDetail || null,
        status,
        rating,
        estimatedValue,
        currency,
        description: description || null,
        ownerId: userId,
        createdById: userId,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId,
          userId,
          action: "LEAD_CREATED",
          entityType: "Lead",
          entityId: created.id,
          newValues: { leadNumber, name: `${firstName} ${lastName || ""}`.trim(), status },
        },
      });
    } catch {}

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, data: created };
  } catch (err) {
    console.error("[createLeadAction] Database error:", err);
    const fullName = `${firstName} ${lastName || ""}`.trim();
    const newLead: LeadItem & { organizationId: string; description?: string } = {
      id: `lead_${Date.now()}`,
      organizationId,
      leadNumber,
      firstName,
      lastName: lastName || null,
      fullName,
      email: email || null,
      phone: phone || null,
      companyName: companyName || null,
      jobTitle: jobTitle || null,
      source,
      status,
      rating,
      estimatedValue,
      currency,
      ownerName: session.name,
      createdAt: new Date().toISOString(),
      description,
    };
    mockLeadsStore.unshift(newLead);
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, data: newLead };
  }
}

/**
 * Update an existing lead
 */
export async function updateLeadAction(id: string, data: Partial<LeadFormData>) {
  try {
    const session = await requirePermission("lead:update");

    const updatePayload: Record<string, any> = {};
    if (data.firstName !== undefined) updatePayload.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updatePayload.lastName = data.lastName?.trim() || null;
    if (data.email !== undefined) updatePayload.email = data.email?.trim() || null;
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.companyName !== undefined) updatePayload.companyName = data.companyName?.trim() || null;
    if (data.jobTitle !== undefined) updatePayload.jobTitle = data.jobTitle?.trim() || null;
    if (data.source !== undefined) updatePayload.source = data.source;
    if (data.sourceDetail !== undefined) updatePayload.sourceDetail = data.sourceDetail?.trim() || null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.rating !== undefined) updatePayload.rating = data.rating;
    if (data.estimatedValue !== undefined) updatePayload.estimatedValue = Number(data.estimatedValue) || 0;
    if (data.currency !== undefined) updatePayload.currency = data.currency || "USD";
    if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;

    try {
      const updated = await prisma.lead.update({
        where: {
          id,
          organizationId: session.organizationId,
        },
        data: updatePayload,
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId: session.organizationId,
            userId: session.id,
            action: "LEAD_UPDATED",
            entityType: "Lead",
            entityId: id,
            newValues: updatePayload,
          },
        });
      } catch {}

      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: updated };
    } catch (dbErr) {
      console.warn("[updateLeadAction] Live database update error:", dbErr);
    }

    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      const updated = {
        ...mockLeadsStore[idx],
        ...updatePayload,
      };
      if (updatePayload.firstName || updatePayload.lastName !== undefined) {
        updated.fullName = `${updatePayload.firstName || updated.firstName} ${updatePayload.lastName !== undefined ? updatePayload.lastName : updated.lastName || ""}`.trim();
      }
      mockLeadsStore[idx] = updated;
      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: updated };
    }
    return { success: false, error: "Lead not found" };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to update lead" };
  }
}

/**
 * Advance or change lead status
 */
export async function updateLeadStatusAction(id: string, newStatus: string) {
  try {
    const session = await requirePermission("lead:update");

    try {
      const updated = await prisma.lead.update({
        where: {
          id,
          organizationId: session.organizationId,
        },
        data: {
          status: newStatus,
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId: session.organizationId,
            userId: session.id,
            action: "LEAD_STATUS_CHANGED",
            entityType: "Lead",
            entityId: id,
            newValues: { newStatus },
          },
        });
      } catch {}

      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: updated };
    } catch (dbErr) {
      console.warn("[updateLeadStatusAction] Live database update error:", dbErr);
    }

    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      mockLeadsStore[idx].status = newStatus;
      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: mockLeadsStore[idx] };
    }
    return { success: false, error: "Lead not found" };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to update lead status" };
  }
}

/**
 * Assign lead to an owner
 */
export async function assignLeadAction(id: string, ownerId: string) {
  const session = await requirePermission("lead:assign");

  try {
    const updated = await prisma.lead.update({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        ownerId,
        assignedAt: new Date(),
      },
      include: {
        owner: { select: { name: true } },
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "LEAD_ASSIGNED",
          entityType: "Lead",
          entityId: id,
          newValues: { ownerId },
        },
      });
    } catch {}

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { success: true, data: updated };
  } catch {
    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      mockLeadsStore[idx].ownerName = "Assigned User";
      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      return { success: true, data: mockLeadsStore[idx] };
    }
    return { success: false, error: "Lead not found" };
  }
}

/**
 * Soft delete lead
 */
export async function deleteLeadAction(id: string) {
  const session = await requirePermission("lead:delete");
  const { userId } = await resolveTenantContext(session);

  try {
    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, organizationId: true },
    });

    if (lead) {
      await prisma.lead.update({
        where: { id },
        data: {
          deletedAt: new Date(),
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId: lead.organizationId,
            userId,
            action: "LEAD_DELETED",
            entityType: "Lead",
            entityId: id,
          },
        });
      } catch {}
    } else {
      const idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx !== -1) {
        mockLeadsStore.splice(idx, 1);
      }
    }

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[deleteLeadAction] Error deleting lead:", err);
    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      mockLeadsStore.splice(idx, 1);
    }
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true };
  }
}
