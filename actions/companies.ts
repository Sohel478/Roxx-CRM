"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import { mockCompaniesStore } from "@/lib/db/mock-store";
import {
  companySchema,
  CompanyFormData,
  CompanyItem,
} from "@/lib/validations/companies";

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
          description: c.description,
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
  await requireAuth();

  try {
    const company = await prisma.company.findFirst({
      where: {
        id,
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
  try {
    const session = await requirePermission("company:create");
    const { organizationId, userId } = await resolveTenantContext(session);
    const parsed = companySchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    }

    const { name, industry, website, email, phone, address, city, state, country, status, description } =
      parsed.data;

    try {
      const created = await prisma.company.create({
        data: {
          organizationId,
          name: name.trim(),
          industry: industry?.trim() || null,
          website: website?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          address: address?.trim() || null,
          city: city?.trim() || null,
          state: state?.trim() || null,
          country: country?.trim() || null,
          status,
          description: description?.trim() || null,
          ownerId: userId,
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "COMPANY_CREATED",
            entityType: "Company",
            entityId: created.id,
            newValues: { name: created.name, status: created.status },
          },
        });
      } catch {}

      revalidatePath("/companies");
      revalidatePath("/dashboard");
      return { success: true, data: created };
    } catch {
      // Mock store fallback for local development preview
      const newComp: CompanyItem & { organizationId: string; description?: string } = {
        id: `comp_${Date.now()}`,
        organizationId,
        name: name.trim(),
        industry: industry?.trim() || null,
        website: website?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || null,
        status,
        createdAt: new Date().toISOString(),
        contactCount: 0,
        description: description?.trim() || undefined,
      };
      mockCompaniesStore.unshift(newComp);
      revalidatePath("/companies");
      revalidatePath("/dashboard");
      return { success: true, data: newComp };
    }
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to create company" };
  }
}

/**
 * Update an existing company
 */
export async function updateCompanyAction(id: string, data: Partial<CompanyFormData>) {
  try {
    const session = await requirePermission("company:update");
    const { userId } = await resolveTenantContext(session);

    const updatePayload: Record<string, any> = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.industry !== undefined) updatePayload.industry = data.industry?.trim() || null;
    if (data.website !== undefined) updatePayload.website = data.website?.trim() || null;
    if (data.email !== undefined) updatePayload.email = data.email?.trim() || null;
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.address !== undefined) updatePayload.address = data.address?.trim() || null;
    if (data.city !== undefined) updatePayload.city = data.city?.trim() || null;
    if (data.state !== undefined) updatePayload.state = data.state?.trim() || null;
    if (data.country !== undefined) updatePayload.country = data.country?.trim() || null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;

    try {
      const existing = await prisma.company.findUnique({
        where: { id },
        select: { id: true, organizationId: true },
      });

      if (existing) {
        const updated = await prisma.company.update({
          where: { id },
          data: updatePayload,
        });

        try {
          await prisma.auditLog.create({
            data: {
              organizationId: existing.organizationId,
              userId,
              action: "COMPANY_UPDATED",
              entityType: "Company",
              entityId: id,
              newValues: updatePayload,
            },
          });
        } catch {}

        revalidatePath("/companies");
        revalidatePath(`/companies/${id}`);
        revalidatePath("/dashboard");
        return { success: true, data: updated };
      }
    } catch (dbErr) {
      console.warn("[updateCompanyAction] Live database update error:", dbErr);
    }

    const index = mockCompaniesStore.findIndex((c) => c.id === id);
    if (index !== -1) {
      mockCompaniesStore[index] = {
        ...mockCompaniesStore[index],
        ...updatePayload,
      };
      revalidatePath("/companies");
      revalidatePath(`/companies/${id}`);
      revalidatePath("/dashboard");
      return { success: true, data: mockCompaniesStore[index] };
    }
    return { success: false, error: "Company not found" };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to update company" };
  }
}

/**
 * Soft delete a company
 */
export async function deleteCompanyAction(id: string) {
  try {
    const session = await requirePermission("company:delete");
    const { userId } = await resolveTenantContext(session);

    try {
      const comp = await prisma.company.findUnique({
        where: { id },
        select: { id: true, organizationId: true },
      });

      if (comp) {
        await prisma.company.update({
          where: { id },
          data: {
            deletedAt: new Date(),
          },
        });

        try {
          await prisma.auditLog.create({
            data: {
              organizationId: comp.organizationId,
              userId,
              action: "COMPANY_DELETED",
              entityType: "Company",
              entityId: id,
            },
          });
        } catch {}
      } else {
        const idx = mockCompaniesStore.findIndex((c) => c.id === id);
        if (idx !== -1) {
          mockCompaniesStore.splice(idx, 1);
        }
      }

      revalidatePath("/companies");
      revalidatePath("/dashboard");
      return { success: true };
    } catch (err) {
      console.error("[deleteCompanyAction] Error deleting company:", err);
      const idx = mockCompaniesStore.findIndex((c) => c.id === id);
      if (idx !== -1) {
        mockCompaniesStore.splice(idx, 1);
      }
      revalidatePath("/companies");
      revalidatePath("/dashboard");
      return { success: true };
    }
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: err?.message || "Failed to delete company" };
  }
}
