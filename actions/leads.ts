"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";

export const leadSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().default("Website"),
  sourceDetail: z.string().optional(),
  status: z.enum(["New", "Contacted", "Qualified", "Unqualified", "Nurture", "Converted", "Lost"]).default("New"),
  rating: z.enum(["Hot", "Warm", "Cold"]).default("Warm"),
  estimatedValue: z.coerce.number().min(0, "Estimated value cannot be negative").default(0),
  currency: z.string().default("USD"),
  description: z.string().optional(),
});

export type LeadFormData = z.infer<typeof leadSchema>;

export interface LeadItem {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  source: string;
  status: string;
  rating: string;
  estimatedValue: number;
  currency: string;
  ownerName: string | null;
  createdAt: string;
}

let mockLeadsStore: (LeadItem & { organizationId: string; description?: string })[] = [
  {
    id: "lead_1",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1001",
    firstName: "Elena",
    lastName: "Rostova",
    fullName: "Elena Rostova",
    email: "elena.rostova@cyberdynesys.local",
    phone: "+1 (555) 492-8172",
    companyName: "Cyberdyne Systems",
    jobTitle: "Director of IT Operations",
    source: "Website",
    status: "New",
    rating: "Hot",
    estimatedValue: 45000,
    currency: "USD",
    ownerName: "Alex Sales",
    createdAt: new Date().toISOString(),
    description: "Inquired about enterprise CRM with 50+ sales seats. Immediate evaluation required.",
  },
  {
    id: "lead_2",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1002",
    firstName: "Marcus",
    lastName: "Vance",
    fullName: "Marcus Vance",
    email: "mvance@vanguardsec.local",
    phone: "+1 (555) 381-9021",
    companyName: "Vanguard Security",
    jobTitle: "VP Sales & Partnerships",
    source: "LinkedIn",
    status: "Contacted",
    rating: "Warm",
    estimatedValue: 28000,
    currency: "USD",
    ownerName: "Sarah Manager",
    createdAt: new Date(Date.now() - 36000000).toISOString(),
    description: "Introductory phone call completed. Budget approved for Q4.",
  },
  {
    id: "lead_3",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1003",
    firstName: "Sofia",
    lastName: "Castillo",
    fullName: "Sofia Castillo",
    email: "sofia@solardynamics.local",
    phone: "+1 (555) 923-1184",
    companyName: "Solar Dynamics",
    jobTitle: "Procurement Manager",
    source: "Referral",
    status: "Qualified",
    rating: "Hot",
    estimatedValue: 65000,
    currency: "USD",
    ownerName: "Alex Sales",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    description: "Met technical criteria and budget. Ready for proposal & opportunity creation.",
  },
  {
    id: "lead_4",
    organizationId: "demo-org-123",
    leadNumber: "LEAD-1004",
    firstName: "Liam",
    lastName: "O'Connor",
    fullName: "Liam O'Connor",
    email: "liam@horizonenergy.local",
    phone: "+1 (555) 120-9482",
    companyName: "Horizon Energy",
    jobTitle: "Operations Analyst",
    source: "Google",
    status: "Nurture",
    rating: "Cold",
    estimatedValue: 15000,
    currency: "USD",
    ownerName: "Admin User",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    description: "Revisit in 6 months when their new regional branch opens.",
  },
];

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
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      organizationId: session.organizationId,
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

  try {
    const lead = await prisma.lead.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
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
        return {
          success: true,
          data: {
            ...mock,
            owner: { id: "usr_alex", name: mock.ownerName || "Alex Sales" },
            activities: [],
            tasks: [],
            notes: [],
          },
        };
      }
      return { success: false, error: "Lead not found" };
    }

    return {
      success: true,
      data: {
        ...lead,
        estimatedValue: Number(lead.estimatedValue || 0),
        fullName: `${lead.firstName} ${lead.lastName || ""}`.trim(),
      },
    };
  } catch {
    const mock = mockLeadsStore.find((l) => l.id === id);
    if (mock) {
      return {
        success: true,
        data: {
          ...mock,
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
        organizationId: session.organizationId,
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
        ownerId: session.id,
        createdById: session.id,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
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
  } catch {
    const fullName = `${firstName} ${lastName || ""}`.trim();
    const newLead: LeadItem & { organizationId: string; description?: string } = {
      id: `lead_${Date.now()}`,
      organizationId: session.organizationId,
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
  const session = await requirePermission("lead:update");

  try {
    const updated = await prisma.lead.update({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        ...data,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "LEAD_UPDATED",
          entityType: "Lead",
          entityId: id,
          newValues: data,
        },
      });
    } catch {}

    revalidatePath("/leads");
    revalidatePath(`/leads/${id}`);
    revalidatePath("/dashboard");
    return { success: true, data: updated };
  } catch {
    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      const updated = {
        ...mockLeadsStore[idx],
        ...data,
      };
      if (data.firstName || data.lastName !== undefined) {
        updated.fullName = `${data.firstName || updated.firstName} ${data.lastName !== undefined ? data.lastName : updated.lastName || ""}`.trim();
      }
      mockLeadsStore[idx] = updated;
      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: updated };
    }
    return { success: false, error: "Lead not found" };
  }
}

/**
 * Advance or change lead status
 */
export async function updateLeadStatusAction(id: string, newStatus: string) {
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
  } catch {
    const idx = mockLeadsStore.findIndex((l) => l.id === id);
    if (idx !== -1) {
      mockLeadsStore[idx].status = newStatus;
      revalidatePath("/leads");
      revalidatePath(`/leads/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: mockLeadsStore[idx] };
    }
    return { success: false, error: "Lead not found" };
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

  try {
    await prisma.lead.update({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "LEAD_DELETED",
          entityType: "Lead",
          entityId: id,
        },
      });
    } catch {}

    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    mockLeadsStore = mockLeadsStore.filter((l) => l.id !== id);
    revalidatePath("/leads");
    revalidatePath("/dashboard");
    return { success: true };
  }
}
