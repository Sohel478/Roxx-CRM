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
  mockUsersStore,
  mockDirectEmailsStore,
  mockMarketingCampaignsStore,
  mockActivitiesStore,
  persistMockLeads,
  syncMockLeadsFromDisk,
} from "@/lib/db/mock-store";
import {
  leadSchema,
  LeadFormData,
  LeadItem,
  isTechfluxOrganization,
} from "@/lib/validations/leads";
import { resolveOwnerNameFromStore } from "@/lib/leads/owner-resolution";
import { SubscriptionService } from "@/lib/subscription/subscription-service";
import { createNotificationHelper } from "@/actions/notifications";

/**
 * Helper to determine or resolve a lead's email status: "Sent" | "Follow up" | "NA"
 */
function resolveLeadEmailStatus(l: {
  emailStatus?: string | null;
  email?: string | null;
  supportEmail?: string | null;
  status?: string | null;
  id?: string;
}): "Sent" | "Follow up" | "NA" {
  // If no email address exists, status is always NA
  if (!l.email && !l.supportEmail) {
    return "NA";
  }

  // If explicit emailStatus has been set to Sent or Follow up, honor it
  if (l.emailStatus === "Sent" || l.emailStatus === "Follow up") {
    return l.emailStatus;
  }

  // Check direct email store
  const hasDirectEmail = mockDirectEmailsStore?.some(
    (d) => (l.id && d.leadId === l.id) || (l.email && d.recipientEmail?.toLowerCase() === l.email.toLowerCase())
  );
  if (hasDirectEmail) {
    return "Sent";
  }

  // Check campaign dispatches
  const hasCampaignDispatch = mockMarketingCampaignsStore?.some(
    (c) => l.id && c.recipientLogs?.some((r) => r.leadId === l.id && (r.status === "SENT" || r.status === "DELIVERED"))
  );
  if (hasCampaignDispatch) {
    return "Sent";
  }

  // Check email activities
  const hasActivity = mockActivitiesStore?.some(
    (a) => a.leadId === l.id && a.type === "EMAIL"
  );
  if (hasActivity) {
    return "Sent";
  }

  // If lead is in Contacted or Nurture stage, it's Follow up
  if (l.status === "Contacted" || l.status === "Nurture") {
    return "Follow up";
  }

  return "NA";
}

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
    syncMockLeadsFromDisk();
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
  ownerId?: string;
  emailStatus?: string;
}) {
  const session = await requireAuth();
  const { organizationId, userId } = await resolveTenantContext(session);
  const isTechfluxOrg = isTechfluxOrganization(session.organizationName, session.organizationId);
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  try {
    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (!isAdminOrManager) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { ownerId: session.id },
            { ownerId: userId },
            { createdById: session.id },
            { createdById: userId },
          ],
        },
      ];
    }

    // Owner / Scope filter
    if (params.ownerId && params.ownerId !== "ALL") {
      if (params.ownerId === "ME") {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { ownerId: session.id },
              { ownerId: userId },
              { createdById: session.id },
              { createdById: userId },
            ],
          },
        ];
      } else if (params.ownerId === "UNASSIGNED") {
        where.ownerId = null;
      } else {
        where.ownerId = params.ownerId;
      }
    }

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
        { supportEmail: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { companyName: { contains: params.search, mode: "insensitive" } },
        { leadNumber: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const allMatching = await prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { id: true, name: true } },
      },
    });

    let mappedItems = allMatching.map((l) => ({
      id: l.id,
      leadNumber: l.leadNumber || `LEAD-${l.id.slice(-4).toUpperCase()}`,
      firstName: l.firstName,
      lastName: l.lastName,
      fullName: `${l.firstName} ${l.lastName || ""}`.trim(),
      email: l.email,
      supportEmail: l.supportEmail || null,
      phone: l.phone,
      companyName: l.companyName,
      jobTitle: l.jobTitle,
      website: (l as any).website || l.description?.match(/Website:\s*([^\s\n\r]+)/i)?.[1] || null,
      companyLinkedin: l.companyLinkedin || null,
      customerLinkedin: l.customerLinkedin || null,
      source: l.source,
      status: l.status,
      rating: l.rating || "Warm",
      estimatedValue: Number(l.estimatedValue || 0),
      currency: l.currency,
      description: l.description,
      emailStatus: resolveLeadEmailStatus(l),
      ownerId: l.ownerId || null,
      createdById: l.createdById || null,
      ownerName: l.owner?.name || null,
      createdAt: l.createdAt.toISOString(),
    }));

    if (params.emailStatus && params.emailStatus !== "ALL") {
      mappedItems = mappedItems.filter((i) => i.emailStatus === params.emailStatus);
    }

    const total = mappedItems.length;
    const paginatedItems = mappedItems.slice(skip, skip + limit);

    return {
      success: true,
      data: {
        isTechfluxOrg,
        items: paginatedItems,
        meta: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    };
  } catch {
    syncMockLeadsFromDisk();
    // In-memory fallback
    let filtered = mockLeadsStore.filter((l) => {
      if (!isAdminOrManager) {
        const isOwner =
          l.ownerId === session.id ||
          l.ownerId === userId ||
          (l.ownerName && (l.ownerName === session.name || l.ownerName === "Alex Sales"));
        const isCreator = l.createdById === session.id || l.createdById === userId;
        if (!isOwner && !isCreator) {
          return false;
        }
      }

      const matchesSearch =
        !params.search ||
        l.fullName.toLowerCase().includes(params.search.toLowerCase()) ||
        (l.email && l.email.toLowerCase().includes(params.search.toLowerCase())) ||
        (l.supportEmail && l.supportEmail.toLowerCase().includes(params.search.toLowerCase())) ||
        (l.companyName && l.companyName.toLowerCase().includes(params.search.toLowerCase())) ||
        (l.leadNumber && l.leadNumber.toLowerCase().includes(params.search.toLowerCase()));

      const matchesStatus = !params.status || params.status === "ALL" || l.status === params.status;
      const matchesSource = !params.source || params.source === "ALL" || l.source === params.source;
      const matchesRating = !params.rating || params.rating === "ALL" || l.rating === params.rating;

      // Owner / Scope filter
      let matchesOwner = true;
      if (params.ownerId && params.ownerId !== "ALL") {
        if (params.ownerId === "ME") {
          matchesOwner = Boolean(
            l.ownerId === session.id ||
            l.ownerId === userId ||
            l.ownerId === "usr_sohel" ||
            l.ownerId === "platform-owner-sohel" ||
            l.createdById === session.id ||
            l.createdById === userId ||
            (l.ownerName && l.ownerName === session.name)
          );
        } else if (params.ownerId === "UNASSIGNED") {
          matchesOwner = !l.ownerId;
        } else {
          matchesOwner =
            l.ownerId === params.ownerId ||
            (params.ownerId === "usr_sheetal" && (l.ownerId === "usr_sheetal" || l.ownerName === "Sheetal D")) ||
            (params.ownerId === "usr_alex" && (l.ownerId === "usr_alex" || l.ownerName === "Alex Sales"));
        }
      }

      // Email status filter
      let matchesEmailStatus = true;
      if (params.emailStatus && params.emailStatus !== "ALL") {
        matchesEmailStatus = resolveLeadEmailStatus(l) === params.emailStatus;
      }

      return matchesSearch && matchesStatus && matchesSource && matchesRating && matchesOwner && matchesEmailStatus;
    });

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + limit);

    return {
      success: true,
      data: {
        isTechfluxOrg,
        items: paginated.map((l) => {
          let resolvedOwnerName = l.ownerName;
          if (!l.ownerId) {
            resolvedOwnerName = null;
          } else {
            resolvedOwnerName = resolveOwnerNameFromStore(l.ownerId, session, resolvedOwnerName);
          }

          return {
            ...l,
            website: l.website || l.description?.match(/Website:\s*([^\s\n\r]+)/i)?.[1] || null,
            emailStatus: resolveLeadEmailStatus(l),
            ownerName: resolvedOwnerName || null,
          };
        }),
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
  const { organizationId, userId } = await resolveTenantContext(session);
  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

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
      let mock = mockLeadsStore.find((l) => l.id === id);
      if (!mock) {
        syncMockLeadsFromDisk();
        mock = mockLeadsStore.find((l) => l.id === id);
      }
      if (mock) {
        if (!isAdminOrManager) {
          const isOwner =
            mock.ownerId === session.id ||
            mock.ownerId === userId ||
            (mock.ownerName && (mock.ownerName === session.name || mock.ownerName === "Alex Sales"));
          const isCreator = mock.createdById === session.id || mock.createdById === userId;
          if (!isOwner && !isCreator) {
            return { success: false, error: "Unauthorized: You do not have access to this lead" };
          }
        }

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

        const resolvedOwnerName = mock.ownerId
          ? resolveOwnerNameFromStore(mock.ownerId, session, mock.ownerName)
          : null;

        const ownerObj =
          mock.ownerId && resolvedOwnerName
            ? { id: mock.ownerId, name: resolvedOwnerName }
            : null;

        return {
          success: true,
          data: {
            ...mock,
            website: mock.website || mock.description?.match(/Website:\s*([^\s\n\r]+)/i)?.[1] || null,
            emailStatus: resolveLeadEmailStatus(mock),
            convertedInfo,
            owner: ownerObj,
            activities: [],
            tasks: [],
            notes: [],
          },
        };
      }
      return { success: false, error: "Lead not found" };
    }

    if (!isAdminOrManager) {
      const isOwner = lead.ownerId === session.id || lead.ownerId === userId;
      const isCreator = lead.createdById === session.id || lead.createdById === userId;
      if (!isOwner && !isCreator) {
        return { success: false, error: "Unauthorized: You do not have access to this lead" };
      }
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
        website: (lead as any).website || lead.description?.match(/Website:\s*([^\s\n\r]+)/i)?.[1] || null,
        emailStatus: resolveLeadEmailStatus(lead),
        convertedInfo,
        estimatedValue: Number(lead.estimatedValue || 0),
        fullName: `${lead.firstName} ${lead.lastName || ""}`.trim(),
      },
    };
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized")) {
      return { success: false, error: err.message };
    }
    console.error("[getLeadByIdAction] Database error:", err);
    let mock = mockLeadsStore.find((l) => l.id === id);
    if (!mock) {
      syncMockLeadsFromDisk();
      mock = mockLeadsStore.find((l) => l.id === id);
    }
    if (mock) {
      if (!isAdminOrManager) {
        const isOwner =
          mock.ownerId === session.id ||
          mock.ownerId === userId ||
          (mock.ownerName && (mock.ownerName === session.name || mock.ownerName === "Alex Sales"));
        const isCreator = mock.createdById === session.id || mock.createdById === userId;
        if (!isOwner && !isCreator) {
          return { success: false, error: "Unauthorized: You do not have access to this lead" };
        }
      }

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

      const resolvedOwnerName = mock.ownerId
        ? resolveOwnerNameFromStore(mock.ownerId, session, mock.ownerName)
        : null;

      const ownerObj =
        mock.ownerId && resolvedOwnerName
          ? { id: mock.ownerId, name: resolvedOwnerName }
          : null;

      return {
        success: true,
        data: {
          ...mock,
          website: mock.website || mock.description?.match(/Website:\s*([^\s\n\r]+)/i)?.[1] || null,
          emailStatus: resolveLeadEmailStatus(mock),
          convertedInfo,
          owner: ownerObj,
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

  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  const limitCheck = await SubscriptionService.checkLimit(organizationId, "leads");
  if (!limitCheck.allowed) {
    return { success: false, error: limitCheck.message || "Lead limit reached. Please upgrade your subscription plan." };
  }

  const parsed = leadSchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const {
    firstName,
    lastName,
    email,
    supportEmail,
    phone,
    companyName,
    jobTitle,
    website,
    companyLinkedin,
    customerLinkedin,
    source,
    sourceDetail,
    status,
    rating,
    estimatedValue,
    currency,
    description,
    emailStatus,
    ownerId,
  } = parsed.data;

  const isUnassigned = ownerId === "UNASSIGNED" || ownerId === null || ownerId === "";
  const finalOwnerId = isUnassigned
    ? (isAdminOrManager ? null : userId)
    : (ownerId || userId);
  const leadNumber = `LEAD-${Math.floor(1000 + Math.random() * 9000)}`;
  const cleanWebsite = website?.trim()
    ? (website.trim().startsWith("http") ? website.trim() : `https://${website.trim()}`)
    : null;

  try {
    const created = await prisma.lead.create({
      data: {
        organizationId,
        leadNumber,
        firstName,
        lastName: lastName || null,
        email: email || null,
        supportEmail: supportEmail || null,
        phone: phone || null,
        companyName: companyName || null,
        jobTitle: jobTitle || null,
        website: cleanWebsite,
        companyLinkedin: companyLinkedin || null,
        customerLinkedin: customerLinkedin || null,
        source,
        sourceDetail: sourceDetail || null,
        status,
        rating,
        estimatedValue,
        currency,
        description: description || null,
        ownerId: finalOwnerId,
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

    await createNotificationHelper({
      organizationId,
      userId,
      type: "LEAD_CREATED",
      title: "New Lead Created",
      message: `${firstName} ${lastName || ""}`.trim() + ` (${currency} ${Number(estimatedValue).toLocaleString()}) was created.`,
      entityType: "lead",
      entityId: created.id,
    });

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, data: created };
  } catch (err) {
    console.error("[createLeadAction] Database error:", err);
    const fullName = `${firstName} ${lastName || ""}`.trim();
    const finalOwnerName = resolveOwnerNameFromStore(
      finalOwnerId,
      session,
      (data as any).ownerName
    );
    const newLead: LeadItem & { organizationId: string; description?: string } = {
      id: `lead_${Date.now()}`,
      organizationId,
      leadNumber,
      firstName,
      lastName: lastName || null,
      fullName,
      email: email || null,
      supportEmail: supportEmail || null,
      phone: phone || null,
      companyName: companyName || null,
      jobTitle: jobTitle || null,
      website: cleanWebsite,
      companyLinkedin: companyLinkedin || null,
      customerLinkedin: customerLinkedin || null,
      source,
      status,
      rating,
      estimatedValue,
      currency,
      ownerId: finalOwnerId,
      createdById: userId,
      ownerName: finalOwnerName,
      createdAt: new Date().toISOString(),
      description,
      emailStatus: emailStatus || "NA",
    };
    mockLeadsStore.unshift(newLead);
    persistMockLeads();

    createNotificationHelper({
      organizationId,
      userId,
      type: "LEAD_CREATED",
      title: "New Lead Created",
      message: `${fullName} (${currency} ${Number(estimatedValue).toLocaleString()}) was created.`,
      entityType: "lead",
      entityId: newLead.id,
    });

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
    const { userId } = await resolveTenantContext(session);
    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    const updatePayload: Record<string, any> = {};
    if (data.firstName !== undefined) updatePayload.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updatePayload.lastName = data.lastName?.trim() || null;
    if (data.email !== undefined) updatePayload.email = data.email?.trim() || null;
    if (data.supportEmail !== undefined) updatePayload.supportEmail = data.supportEmail?.trim() || null;
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.companyName !== undefined) updatePayload.companyName = data.companyName?.trim() || null;
    if (data.jobTitle !== undefined) updatePayload.jobTitle = data.jobTitle?.trim() || null;
    if (data.website !== undefined) {
      updatePayload.website = data.website?.trim()
        ? (data.website.trim().startsWith("http") ? data.website.trim() : `https://${data.website.trim()}`)
        : null;
    }
    if (data.companyLinkedin !== undefined) updatePayload.companyLinkedin = data.companyLinkedin?.trim() || null;
    if (data.customerLinkedin !== undefined) updatePayload.customerLinkedin = data.customerLinkedin?.trim() || null;
    if (data.source !== undefined) updatePayload.source = data.source;
    if (data.sourceDetail !== undefined) updatePayload.sourceDetail = data.sourceDetail?.trim() || null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.rating !== undefined) updatePayload.rating = data.rating;
    if (data.estimatedValue !== undefined) updatePayload.estimatedValue = Number(data.estimatedValue) || 0;
    if (data.currency !== undefined) updatePayload.currency = data.currency || "USD";
    if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
    if (data.emailStatus !== undefined) updatePayload.emailStatus = data.emailStatus;
    if (data.ownerId !== undefined && isAdminOrManager) {
      const isUnassign = !data.ownerId || data.ownerId === "UNASSIGNED";
      updatePayload.ownerId = isUnassign ? null : data.ownerId;
      updatePayload.assignedAt = new Date();
    }

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

    let idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      syncMockLeadsFromDisk();
      idx = mockLeadsStore.findIndex((l) => l.id === id);
    }
    if (idx !== -1) {
      const updated = {
        ...mockLeadsStore[idx],
        ...updatePayload,
      };
      if (updatePayload.firstName || updatePayload.lastName !== undefined) {
        updated.fullName = `${updatePayload.firstName || updated.firstName} ${updatePayload.lastName !== undefined ? updatePayload.lastName : updated.lastName || ""}`.trim();
      }
      if (updatePayload.ownerId !== undefined) {
        const targetOwnerId =
          updatePayload.ownerId === "UNASSIGNED" ? null : updatePayload.ownerId;
        updated.ownerId = targetOwnerId;
        updated.ownerName = resolveOwnerNameFromStore(
          targetOwnerId,
          session,
          (data as any).ownerName || updated.ownerName
        );
      }
      mockLeadsStore[idx] = updated;
      persistMockLeads();
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
 * Quick inline update of a lead's email status (Sent / Follow up / NA)
 */
export async function updateLeadEmailStatusAction(
  leadId: string,
  emailStatus: "Sent" | "Follow up" | "NA"
) {
  const session = await requireAuth();
  const valid = ["Sent", "Follow up", "NA"];
  if (!valid.includes(emailStatus)) {
    return { success: false, error: "Invalid email status" };
  }

  try {
    try {
      await prisma.lead.update({
        where: { id: leadId, organizationId: session.organizationId },
        data: { updatedAt: new Date() },
      });
    } catch {}

    let idx = mockLeadsStore.findIndex((l) => l.id === leadId);
    if (idx === -1) {
      syncMockLeadsFromDisk();
      idx = mockLeadsStore.findIndex((l) => l.id === leadId);
    }
    if (idx !== -1) {
      mockLeadsStore[idx].emailStatus = emailStatus;
      persistMockLeads();
    }

    revalidatePath("/leads");
    revalidatePath(`/leads/${leadId}`);
    return { success: true, data: { id: leadId, emailStatus } };
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to update email status" };
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

    let idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      syncMockLeadsFromDisk();
      idx = mockLeadsStore.findIndex((l) => l.id === id);
    }
    if (idx !== -1) {
      mockLeadsStore[idx].status = newStatus;
      persistMockLeads();
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
  const session = await requireAuth();
  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  if (!isAdminOrManager) {
    return { success: false, error: "Unauthorized: Only Admins and Managers can reassign leads" };
  }

  const { userId } = await resolveTenantContext(session);
  const isUnassign = !ownerId || ownerId === "UNASSIGNED";
  const targetOwnerId = isUnassign ? null : ownerId;

  try {
    const updated = await prisma.lead.update({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        ownerId: targetOwnerId,
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
          newValues: { ownerId: targetOwnerId },
        },
      });
    } catch {}

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    return { success: true, data: updated };
  } catch {
    let idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      syncMockLeadsFromDisk();
      idx = mockLeadsStore.findIndex((l) => l.id === id);
    }
    if (idx !== -1) {
      mockLeadsStore[idx].ownerId = targetOwnerId;
      mockLeadsStore[idx].ownerName = resolveOwnerNameFromStore(
        targetOwnerId,
        session,
        mockLeadsStore[idx].ownerName
      );
      persistMockLeads();
      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      return { success: true, data: mockLeadsStore[idx] };
    }
    return { success: false, error: "Lead not found" };
  }
}

/**
 * Pick / Claim lead from Scraped status: moves status to "New" and assigns to current sales rep
 */
export async function pickLeadAction(id: string) {
  try {
    const session = await requireAuth();
    const { organizationId, userId } = await resolveTenantContext(session);

    try {
      const updated = await prisma.lead.update({
        where: {
          id,
          organizationId,
        },
        data: {
          status: "New",
          ownerId: userId,
          assignedAt: new Date(),
        },
        include: {
          owner: { select: { name: true } },
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "LEAD_CLAIMED",
            entityType: "Lead",
            entityId: id,
            newValues: {
              previousStatus: "Scraped",
              newStatus: "New",
              ownerId: userId,
              ownerName: session.name || "Sales Rep",
            },
          },
        });
      } catch {}

      await createNotificationHelper({
        organizationId,
        userId,
        type: "LEAD_ASSIGNED",
        title: "Lead Claimed & Activated",
        message: `You picked ${updated.firstName} ${updated.lastName || ""}`.trim() + " from Scraped and activated it to New.",
        entityType: "lead",
        entityId: id,
      });

      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: updated };
    } catch (dbErr) {
      console.warn("[pickLeadAction] Database error, falling back to mock store:", dbErr);
    }

    let idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      syncMockLeadsFromDisk();
      idx = mockLeadsStore.findIndex((l) => l.id === id);
    }
    if (idx !== -1) {
      mockLeadsStore[idx].status = "New";
      mockLeadsStore[idx].ownerId = session.id || userId;
      mockLeadsStore[idx].ownerName = session.name || "Current User";
      persistMockLeads();
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
    return { success: false, error: err?.message || "Failed to pick lead" };
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
      let idx = mockLeadsStore.findIndex((l) => l.id === id);
      if (idx === -1) {
        syncMockLeadsFromDisk();
        idx = mockLeadsStore.findIndex((l) => l.id === id);
      }
      if (idx !== -1) {
        mockLeadsStore.splice(idx, 1);
        persistMockLeads();
      }
    }

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err) {
    console.error("[deleteLeadAction] Error deleting lead:", err);
    let idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx === -1) {
      syncMockLeadsFromDisk();
      idx = mockLeadsStore.findIndex((l) => l.id === id);
    }
    if (idx !== -1) {
      mockLeadsStore.splice(idx, 1);
      persistMockLeads();
    }
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true };
  }
}

/**
 * Bulk assign leads to a specific owner (Admin/Manager only)
 */
export async function bulkAssignLeadsAction(leadIds: string[], ownerId: string) {
  try {
    const session = await requireAuth();
    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    if (!isAdminOrManager) {
      return { success: false, error: "Unauthorized: Only Admins and Managers can reassign leads" };
    }

    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return { success: false, error: "No leads selected for assignment" };
    }

    if (!ownerId || typeof ownerId !== "string") {
      return { success: false, error: "Invalid target owner" };
    }

    const { organizationId, userId } = await resolveTenantContext(session);
    const isUnassign = !ownerId || ownerId === "UNASSIGNED";
    const isMe =
      ownerId === "ME" ||
      ownerId === session.id ||
      ownerId === userId ||
      ownerId === "usr_sohel" ||
      ownerId === "platform-owner-sohel";
    const targetOwnerId = isUnassign ? null : (isMe ? (session.id || userId || "platform-owner-sohel") : ownerId);
    const assignedName = resolveOwnerNameFromStore(targetOwnerId, session);

    let updatedCount = 0;
    try {
      const result = await prisma.lead.updateMany({
        where: {
          id: { in: leadIds },
          organizationId,
          deletedAt: null,
        },
        data: {
          ownerId: targetOwnerId,
          assignedAt: new Date(),
        },
      });
      updatedCount = result.count;

      try {
        await prisma.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "LEADS_BULK_ASSIGNED",
            entityType: "Lead",
            entityId: leadIds[0] || "bulk",
            newValues: { leadIds, ownerId: targetOwnerId, count: updatedCount },
          },
        });
      } catch {}
    } catch (dbErr) {
      console.warn("[bulkAssignLeadsAction] Database updateMany error, falling back to mock store:", dbErr);
    }

    // Update mockLeadsStore as well
    syncMockLeadsFromDisk();
    let mockUpdatedCount = 0;
    for (const lead of mockLeadsStore) {
      if (leadIds.includes(lead.id)) {
        lead.ownerId = targetOwnerId;
        lead.ownerName = assignedName;
        mockUpdatedCount++;
      }
    }
    if (mockUpdatedCount > 0) {
      persistMockLeads();
    }

    const finalCount = updatedCount || mockUpdatedCount;

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, count: finalCount };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to bulk assign leads" };
  }
}

/**
 * Bulk soft-delete leads
 */
export async function bulkDeleteLeadsAction(leadIds: string[]) {
  try {
    const session = await requirePermission("lead:delete");
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return { success: false, error: "No leads selected for deletion" };
    }

    const { organizationId, userId } = await resolveTenantContext(session);
    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    // If not admin/manager, sales rep can only delete leads they own or created
    const scopedFilter = isAdminOrManager
      ? { id: { in: leadIds }, organizationId, deletedAt: null }
      : {
          id: { in: leadIds },
          organizationId,
          deletedAt: null,
          OR: [{ ownerId: userId }, { createdById: userId }],
        };

    let deletedCount = 0;
    try {
      const result = await prisma.lead.updateMany({
        where: scopedFilter,
        data: {
          deletedAt: new Date(),
        },
      });
      deletedCount = result.count;

      try {
        await prisma.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "LEADS_BULK_DELETED",
            entityType: "Lead",
            entityId: leadIds[0] || "bulk",
            newValues: { leadIds, count: deletedCount },
          },
        });
      } catch {}
    } catch (dbErr) {
      console.warn("[bulkDeleteLeadsAction] Database error, falling back to mock store:", dbErr);
    }

    // Mock store deletion
    syncMockLeadsFromDisk();
    let mockDeletedCount = 0;
    for (let i = mockLeadsStore.length - 1; i >= 0; i--) {
      const l = mockLeadsStore[i];
      if (leadIds.includes(l.id)) {
        if (isAdminOrManager || l.ownerId === userId || l.createdById === userId) {
          mockLeadsStore.splice(i, 1);
          mockDeletedCount++;
        }
      }
    }
    if (mockDeletedCount > 0) {
      persistMockLeads();
    }

    const finalCount = deletedCount || mockDeletedCount;

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true, count: finalCount };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to bulk delete leads" };
  }
}

