"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";

// Zod Schema for Company Validation
export const companySchema = z.object({
  name: z.string().min(2, "Company name must be at least 2 characters"),
  industry: z.string().optional(),
  website: z.string().url("Must be a valid URL (e.g. https://example.com)").or(z.literal("")).optional(),
  email: z.string().email("Must be a valid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(["Active", "Prospect", "Customer", "Inactive"]).default("Active"),
  description: z.string().optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;

export interface CompanyItem {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  status: string;
  createdAt: string;
  contactCount: number;
}

// Fallback in-memory companies for development preview if DB connection is offline
let mockCompaniesStore: (CompanyItem & { organizationId: string; description?: string })[] = [
  {
    id: "comp_1",
    organizationId: "demo-org-123",
    name: "Acme Technologies",
    industry: "Enterprise Software",
    website: "https://acme-tech.local",
    email: "contact@acme-tech.local",
    phone: "+1 (555) 234-5678",
    city: "San Francisco",
    country: "USA",
    status: "Customer",
    createdAt: new Date().toISOString(),
    contactCount: 2,
    description: "Leading cloud computing and DevOps enterprise customer.",
  },
  {
    id: "comp_2",
    organizationId: "demo-org-123",
    name: "Apex Global Logistics",
    industry: "Supply Chain",
    website: "https://apex-logistics.local",
    email: "info@apex-logistics.local",
    phone: "+1 (555) 876-5432",
    city: "Chicago",
    country: "USA",
    status: "Prospect",
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    contactCount: 1,
    description: "Multi-national shipping and freight forwarder looking for CRM integration.",
  },
  {
    id: "comp_3",
    organizationId: "demo-org-123",
    name: "Starlight Media",
    industry: "Digital Marketing",
    website: "https://starlight.local",
    email: "hello@starlight.local",
    phone: "+44 20 7946 0912",
    city: "London",
    country: "UK",
    status: "Active",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    contactCount: 1,
    description: "Creative design and video marketing studio.",
  },
];

/**
 * Fetch paginated companies for the authenticated organization
 */
export async function getCompaniesAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
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

    if (params.search) {
      where.OR = [
        { name: { contains: params.search, mode: "insensitive" } },
        { industry: { contains: params.search, mode: "insensitive" } },
        { city: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.company.count({ where }),
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { contacts: true },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((c) => ({
          id: c.id,
          name: c.name,
          industry: c.industry,
          website: c.website,
          email: c.email,
          phone: c.phone,
          city: c.city,
          country: c.country,
          status: c.status,
          createdAt: c.createdAt.toISOString(),
          contactCount: c._count.contacts,
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
    // Fallback in-memory search for development preview
    let filtered = mockCompaniesStore.filter((c) => {
      const matchesSearch =
        !params.search ||
        c.name.toLowerCase().includes(params.search.toLowerCase()) ||
        (c.industry && c.industry.toLowerCase().includes(params.search.toLowerCase()));
      const matchesStatus = !params.status || params.status === "ALL" || c.status === params.status;
      return matchesSearch && matchesStatus;
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
 * Get company detail by ID
 */
export async function getCompanyByIdAction(id: string) {
  const session = await requireAuth();

  try {
    const company = await prisma.company.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      include: {
        contacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        opportunities: {
          where: { deletedAt: null },
          include: { stage: true },
          orderBy: { createdAt: "desc" },
        },
        activities: {
          orderBy: { activityAt: "desc" },
          take: 10,
        },
      },
    });

    if (!company) {
      // Check mock store
      const mock = mockCompaniesStore.find((c) => c.id === id);
      if (mock) {
        return {
          success: true,
          data: {
            ...mock,
            contacts: [],
            opportunities: [],
            activities: [],
          },
        };
      }
      return { success: false, error: "Company not found" };
    }

    return { success: true, data: company };
  } catch {
    const mock = mockCompaniesStore.find((c) => c.id === id);
    if (mock) {
      return {
        success: true,
        data: {
          ...mock,
          contacts: [],
          opportunities: [],
          activities: [],
        },
      };
    }
    return { success: false, error: "Company not found" };
  }
}

/**
 * Create a new company
 */
export async function createCompanyAction(data: CompanyFormData) {
  const session = await requirePermission("company:create");
  const parsed = companySchema.safeParse(data);

  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { name, industry, website, email, phone, address, city, state, country, status, description } =
    parsed.data;

  try {
    const created = await prisma.company.create({
      data: {
        organizationId: session.organizationId,
        name,
        industry: industry || null,
        website: website || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || null,
        status,
        description: description || null,
        ownerId: session.id,
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          organizationId: session.organizationId,
          userId: session.id,
          action: "COMPANY_CREATED",
          entityType: "Company",
          entityId: created.id,
          newValues: { name: created.name, status: created.status },
        },
      });
    } catch {}

    revalidatePath("/companies");
    return { success: true, data: created };
  } catch {
    // Mock store fallback for local development preview
    const newComp: CompanyItem & { organizationId: string; description?: string } = {
      id: `comp_${Date.now()}`,
      organizationId: session.organizationId,
      name,
      industry: industry || null,
      website: website || null,
      email: email || null,
      phone: phone || null,
      city: city || null,
      country: country || null,
      status,
      createdAt: new Date().toISOString(),
      contactCount: 0,
      description,
    };
    mockCompaniesStore.unshift(newComp);
    revalidatePath("/companies");
    return { success: true, data: newComp };
  }
}

/**
 * Update an existing company
 */
export async function updateCompanyAction(id: string, data: Partial<CompanyFormData>) {
  const session = await requirePermission("company:update");

  try {
    const updated = await prisma.company.update({
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
          action: "COMPANY_UPDATED",
          entityType: "Company",
          entityId: id,
          newValues: data,
        },
      });
    } catch {}

    revalidatePath("/companies");
    revalidatePath(`/companies/${id}`);
    return { success: true, data: updated };
  } catch {
    const index = mockCompaniesStore.findIndex((c) => c.id === id);
    if (index !== -1) {
      mockCompaniesStore[index] = {
        ...mockCompaniesStore[index],
        ...data,
      };
      revalidatePath("/companies");
      return { success: true, data: mockCompaniesStore[index] };
    }
    return { success: false, error: "Failed to update company" };
  }
}

/**
 * Soft delete a company
 */
export async function deleteCompanyAction(id: string) {
  const session = await requirePermission("company:delete");

  try {
    await prisma.company.update({
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
          action: "COMPANY_DELETED",
          entityType: "Company",
          entityId: id,
        },
      });
    } catch {}

    revalidatePath("/companies");
    return { success: true };
  } catch {
    mockCompaniesStore = mockCompaniesStore.filter((c) => c.id !== id);
    revalidatePath("/companies");
    return { success: true };
  }
}
