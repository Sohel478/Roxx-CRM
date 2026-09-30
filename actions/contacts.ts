"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import { resolveTenantContext } from "@/lib/auth/tenant";
import { mockContactsStore, mockCompaniesStore, mockUsersStore } from "@/lib/db/mock-store";
import {
  contactSchema,
  ContactFormData,
  ContactItem,
} from "@/lib/validations/contacts";
import { SubscriptionService } from "@/lib/subscription/subscription-service";
import { createNotificationHelper } from "@/actions/notifications";

/**
 * Fetch paginated contacts
 */
export async function getContactsAction(params: {
  page?: number;
  limit?: number;
  search?: string;
  companyId?: string;
}) {
  const session = await requireAuth();
  const { organizationId } = await resolveTenantContext(session);
  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  try {
    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (!isAdminOrManager) {
      where.ownerId = session.id;
    }

    if (params.companyId && params.companyId !== "ALL") {
      where.companyId = params.companyId;
    }

    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: "insensitive" } },
        { lastName: { contains: params.search, mode: "insensitive" } },
        { email: { contains: params.search, mode: "insensitive" } },
        { phone: { contains: params.search, mode: "insensitive" } },
        { jobTitle: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.contact.count({ where }),
      prisma.contact.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          company: {
            select: { id: true, name: true },
          },
          owner: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        items: items.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          fullName: `${c.firstName} ${c.lastName || ""}`.trim(),
          email: c.email,
          phone: c.phone,
          alternatePhone: c.alternatePhone,
          jobTitle: c.jobTitle,
          department: c.department,
          linkedinUrl: c.linkedinUrl,
          instagramUrl: (c as any).instagramUrl || null,
          companyId: c.companyId,
          companyName: c.company?.name || null,
          address: c.address,
          createdAt: c.createdAt.toISOString(),
          ownerId: c.ownerId,
          ownerName: c.owner?.name || null,
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
    let filtered = mockContactsStore.filter((c) => {
      if (c.organizationId && c.organizationId !== organizationId) return false;
      if (!isAdminOrManager && c.ownerId && c.ownerId !== session.id) return false;
      const matchesSearch =
        !params.search ||
        c.fullName.toLowerCase().includes(params.search.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(params.search.toLowerCase())) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(params.search.toLowerCase())) ||
        (c.companyName && c.companyName.toLowerCase().includes(params.search.toLowerCase()));
      const matchesCompany = !params.companyId || params.companyId === "ALL" || c.companyId === params.companyId;
      return matchesSearch && matchesCompany;
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
 * Get contact by ID
 */
export async function getContactByIdAction(id: string) {
  const session = await requireAuth();
  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  try {
    const contact = await prisma.contact.findFirst({
      where: {
        id,
        organizationId: session.organizationId,
        deletedAt: null,
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        company: true,
        opportunities: {
          where: { deletedAt: null },
          include: { stage: true },
        },
        activities: {
          orderBy: { activityAt: "desc" },
          take: 10,
        },
        tasks: {
          where: { status: { not: "CANCELLED" } },
          orderBy: { dueAt: "asc" },
        },
      },
    });

    if (!contact) {
      const mock = mockContactsStore.find(
        (c) => c.id === id && (c.organizationId === session.organizationId || !c.organizationId)
      );
      if (mock) {
        if (!isAdminOrManager && mock.ownerId && mock.ownerId !== session.id) {
          return { success: false, error: "Unauthorized: You can only view contacts assigned to you" };
        }
        return {
          success: true,
          data: {
            ...mock,
            company: { id: mock.companyId, name: mock.companyName },
            opportunities: [],
            activities: [],
            tasks: [],
          },
        };
      }
      return { success: false, error: "Contact not found" };
    }

    if (!isAdminOrManager && contact.ownerId && contact.ownerId !== session.id) {
      return { success: false, error: "Unauthorized: You can only view contacts assigned to you" };
    }

    return {
      success: true,
      data: {
        ...contact,
        ownerId: contact.ownerId,
        ownerName: contact.owner?.name || null,
      },
    };
  } catch {
    const mock = mockContactsStore.find(
      (c) => c.id === id && (c.organizationId === session.organizationId || !c.organizationId)
    );
    if (mock) {
      if (!isAdminOrManager && mock.ownerId && mock.ownerId !== session.id) {
        return { success: false, error: "Unauthorized: You can only view contacts assigned to you" };
      }
      return {
        success: true,
        data: {
          ...mock,
          company: { id: mock.companyId, name: mock.companyName },
          opportunities: [],
          activities: [],
          tasks: [],
        },
      };
    }
    return { success: false, error: "Contact not found" };
  }
}

function normalizeSocialUrl(url?: string | null, platform: "instagram" | "linkedin" = "instagram") {
  if (!url) return null;
  let clean = url.trim();
  if (!clean) return null;
  if (platform === "instagram") {
    if (clean.startsWith("@")) {
      return `https://instagram.com/${clean.slice(1)}`;
    }
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      return clean.includes("instagram.com") ? `https://${clean}` : `https://instagram.com/${clean}`;
    }
  } else if (platform === "linkedin") {
    if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
      return clean.includes("linkedin.com") ? `https://${clean}` : `https://linkedin.com/in/${clean}`;
    }
  }
  return clean;
}

/**
 * Create a new contact
 */
export async function createContactAction(data: ContactFormData) {
  try {
    const session = await requirePermission("contact:create");
    const { organizationId, userId } = await resolveTenantContext(session);

    const limitCheck = await SubscriptionService.checkLimit(organizationId, "contacts");
    if (!limitCheck.allowed) {
      return { success: false, error: limitCheck.message || "Contact limit reached. Please upgrade your subscription plan." };
    }

    const parsed = contactSchema.safeParse(data);

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0]?.message || "Invalid input" };
    }

    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    const finalOwnerId = isAdminOrManager && parsed.data.ownerId ? parsed.data.ownerId : userId;
    const assignedUser = mockUsersStore.find((u) => u.id === finalOwnerId);
    const assignedOwnerName = assignedUser ? assignedUser.name : (finalOwnerId === userId ? session.name : "Sales Rep");

    const {
      firstName,
      lastName,
      email,
      phone,
      alternatePhone,
      jobTitle,
      department,
      linkedinUrl,
      instagramUrl,
      companyId,
      newCompanyName,
      newCompanyWebsite,
      address,
    } = parsed.data;

    let finalCompanyId = companyId || null;
    let finalCompanyName: string | null = null;

    // Handle inline creation of a new company directly from contact form
    if (newCompanyName && newCompanyName.trim().length > 0) {
      const compName = newCompanyName.trim();
      let compWebsite = newCompanyWebsite?.trim() || null;
      if (compWebsite && !compWebsite.startsWith("http://") && !compWebsite.startsWith("https://")) {
        compWebsite = `https://${compWebsite}`;
      }

      try {
        const createdComp = await prisma.company.create({
          data: {
            organizationId,
            name: compName,
            website: compWebsite,
            ownerId: finalOwnerId,
            status: "Active",
          },
        });
        finalCompanyId = createdComp.id;
        finalCompanyName = createdComp.name;
      } catch (compErr) {
        console.warn("[createContactAction] DB company create fallback:", compErr);
        const newCompId = `comp_${Date.now()}`;
        const newMockComp: any = {
          id: newCompId,
          organizationId,
          name: compName,
          industry: null,
          website: compWebsite,
          email: null,
          phone: null,
          city: null,
          country: null,
          status: "Active",
          ownerId: finalOwnerId,
          ownerName: assignedOwnerName,
          createdAt: new Date().toISOString(),
          contactCount: 1,
        };
        mockCompaniesStore.unshift(newMockComp);
        finalCompanyId = newCompId;
        finalCompanyName = compName;
      }
      revalidatePath("/companies");
    } else if (finalCompanyId) {
      const found = mockCompaniesStore.find((c) => c.id === finalCompanyId);
      if (found) finalCompanyName = found.name;
    }

    const cleanLinkedin = normalizeSocialUrl(linkedinUrl, "linkedin");
    const cleanInstagram = normalizeSocialUrl(instagramUrl, "instagram");

    try {
      const created = await prisma.contact.create({
        data: {
          organizationId,
          firstName: firstName.trim(),
          lastName: lastName?.trim() || null,
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          alternatePhone: alternatePhone?.trim() || null,
          jobTitle: jobTitle?.trim() || null,
          department: department?.trim() || null,
          linkedinUrl: cleanLinkedin,
          instagramUrl: cleanInstagram,
          companyId: finalCompanyId,
          address: address?.trim() || null,
          ownerId: finalOwnerId,
        },
        include: {
          company: { select: { id: true, name: true } },
          owner: { select: { id: true, name: true } },
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            organizationId,
            userId,
            action: "CONTACT_CREATED",
            entityType: "Contact",
            entityId: created.id,
            newValues: { name: `${created.firstName} ${created.lastName || ""}`.trim() },
          },
        });
      } catch {}

      await createNotificationHelper({
        organizationId,
        userId,
        type: "CONTACT_CREATED",
        title: "New Contact Created",
        message: `${created.firstName} ${created.lastName || ""}`.trim() + (finalCompanyName ? ` at ${finalCompanyName}` : "") + " was added.",
        entityType: "contact",
        entityId: created.id,
      });

      revalidatePath("/contacts");
      if (finalCompanyId) revalidatePath(`/companies/${finalCompanyId}`);
      revalidatePath("/companies");
      return { success: true, data: created };
    } catch {
      const fullName = `${firstName} ${lastName || ""}`.trim();
      const newContact: ContactItem & { organizationId: string } = {
        id: `cont_${Date.now()}`,
        organizationId,
        firstName: firstName.trim(),
        lastName: lastName?.trim() || null,
        fullName,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        alternatePhone: alternatePhone?.trim() || null,
        jobTitle: jobTitle?.trim() || null,
        department: department?.trim() || null,
        linkedinUrl: cleanLinkedin,
        instagramUrl: cleanInstagram,
        companyId: finalCompanyId,
        companyName: finalCompanyName || (finalCompanyId ? "Acme Technologies" : null),
        address: address?.trim() || null,
        createdAt: new Date().toISOString(),
        ownerId: finalOwnerId,
        ownerName: assignedOwnerName,
      };
      mockContactsStore.unshift(newContact);

      createNotificationHelper({
        organizationId,
        userId,
        type: "CONTACT_CREATED",
        title: "New Contact Created",
        message: `${fullName}` + (finalCompanyName ? ` at ${finalCompanyName}` : "") + " was added.",
        entityType: "contact",
        entityId: newContact.id,
      });

      revalidatePath("/contacts");
      if (finalCompanyId) revalidatePath(`/companies/${finalCompanyId}`);
      revalidatePath("/companies");
      return { success: true, data: newContact };
    }
  } catch (err: unknown) {
    const errorObj = err as { digest?: string; message?: string };
    if (errorObj?.digest?.includes?.("NEXT_REDIRECT") || errorObj?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: errorObj?.message || "Failed to create contact" };
  }
}

/**
 * Update contact
 */
export async function updateContactAction(id: string, data: Partial<ContactFormData>) {
  try {
    const session = await requirePermission("contact:update");
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
    if (data.phone !== undefined) updatePayload.phone = data.phone?.trim() || null;
    if (data.alternatePhone !== undefined) updatePayload.alternatePhone = data.alternatePhone?.trim() || null;
    if (data.jobTitle !== undefined) updatePayload.jobTitle = data.jobTitle?.trim() || null;
    if (data.department !== undefined) updatePayload.department = data.department?.trim() || null;
    if (data.linkedinUrl !== undefined) updatePayload.linkedinUrl = normalizeSocialUrl(data.linkedinUrl, "linkedin");
    if (data.instagramUrl !== undefined) updatePayload.instagramUrl = normalizeSocialUrl(data.instagramUrl, "instagram");
    if (data.address !== undefined) updatePayload.address = data.address?.trim() || null;
    if (isAdminOrManager && data.ownerId !== undefined) {
      updatePayload.ownerId = data.ownerId || null;
    }

    if (data.newCompanyName && data.newCompanyName.trim().length > 0) {
      const compName = data.newCompanyName.trim();
      let compWebsite = data.newCompanyWebsite?.trim() || null;
      if (compWebsite && !compWebsite.startsWith("http://") && !compWebsite.startsWith("https://")) {
        compWebsite = `https://${compWebsite}`;
      }
      try {
        const createdComp = await prisma.company.create({
          data: {
            organizationId: "demo-org-123",
            name: compName,
            website: compWebsite,
            ownerId: userId,
            status: "Active",
          },
        });
        updatePayload.companyId = createdComp.id;
      } catch {
        const newCompId = `comp_${Date.now()}`;
        mockCompaniesStore.unshift({
          id: newCompId,
          organizationId: "demo-org-123",
          name: compName,
          industry: null,
          website: compWebsite,
          email: null,
          phone: null,
          city: null,
          country: null,
          status: "Active",
          createdAt: new Date().toISOString(),
          contactCount: 1,
        } as any);
        updatePayload.companyId = newCompId;
      }
      revalidatePath("/companies");
    } else if (data.companyId !== undefined) {
      updatePayload.companyId = data.companyId || null;
    }

    try {
      const existing = await prisma.contact.findUnique({
        where: { id },
        select: { id: true, organizationId: true, ownerId: true },
      });

      if (existing) {
        if (!isAdminOrManager && existing.ownerId && existing.ownerId !== userId) {
          return { success: false, error: "Unauthorized: You can only update contacts assigned to you" };
        }

        const updated = await prisma.contact.update({
          where: { id },
          data: updatePayload,
        });

        try {
          await prisma.auditLog.create({
            data: {
              organizationId: existing.organizationId,
              userId,
              action: "CONTACT_UPDATED",
              entityType: "Contact",
              entityId: id,
              newValues: updatePayload,
            },
          });
        } catch {}

        revalidatePath("/contacts");
        revalidatePath(`/contacts/${id}`);
        return { success: true, data: updated };
      }
    } catch (dbErr) {
      console.warn("[updateContactAction] Live database update error:", dbErr);
    }

    const idx = mockContactsStore.findIndex((c) => c.id === id);
    if (idx !== -1) {
      if (!isAdminOrManager && mockContactsStore[idx].ownerId && mockContactsStore[idx].ownerId !== userId) {
        return { success: false, error: "Unauthorized: You can only update contacts assigned to you" };
      }

      const updated = {
        ...mockContactsStore[idx],
        ...updatePayload,
      };
      if (updatePayload.firstName || updatePayload.lastName !== undefined) {
        updated.fullName = `${updatePayload.firstName || updated.firstName} ${updatePayload.lastName !== undefined ? updatePayload.lastName : updated.lastName || ""}`.trim();
      }
      if (updatePayload.companyId !== undefined) {
        const comp = mockCompaniesStore.find((c) => c.id === updatePayload.companyId);
        updated.companyName = comp?.name || null;
      }
      if (isAdminOrManager && updatePayload.ownerId !== undefined) {
        const assignedUser = mockUsersStore.find((u) => u.id === updatePayload.ownerId);
        updated.ownerName = assignedUser ? assignedUser.name : null;
      }
      mockContactsStore[idx] = updated;
      revalidatePath("/contacts");
      return { success: true, data: updated };
    }
    return { success: false, error: "Contact not found" };
  } catch (err: unknown) {
    const errorObj = err as { digest?: string; message?: string };
    if (errorObj?.digest?.includes?.("NEXT_REDIRECT") || errorObj?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: errorObj?.message || "Failed to update contact" };
  }
}

/**
 * Soft delete contact
 */
export async function deleteContactAction(id: string) {
  try {
    const session = await requirePermission("contact:delete");
    const { userId } = await resolveTenantContext(session);
    const roleUpper = session.role?.toUpperCase();
    const isAdminOrManager =
      roleUpper === "ADMIN" ||
      roleUpper === "ADMINISTRATOR" ||
      roleUpper === "MANAGER" ||
      Boolean(session.isSuperAdmin);

    try {
      const cont = await prisma.contact.findUnique({
        where: { id },
        select: { id: true, organizationId: true, ownerId: true },
      });

      if (cont) {
        if (!isAdminOrManager && cont.ownerId && cont.ownerId !== userId) {
          return { success: false, error: "Unauthorized: You can only delete contacts assigned to you" };
        }

        await prisma.contact.update({
          where: { id },
          data: {
            deletedAt: new Date(),
          },
        });

        try {
          await prisma.auditLog.create({
            data: {
              organizationId: cont.organizationId,
              userId,
              action: "CONTACT_DELETED",
              entityType: "Contact",
              entityId: id,
            },
          });
        } catch {}
      } else {
        const idx = mockContactsStore.findIndex((c) => c.id === id);
        if (idx !== -1) {
          if (!isAdminOrManager && mockContactsStore[idx].ownerId && mockContactsStore[idx].ownerId !== userId) {
            return { success: false, error: "Unauthorized: You can only delete contacts assigned to you" };
          }
          mockContactsStore.splice(idx, 1);
        }
      }

      revalidatePath("/contacts");
      revalidatePath("/dashboard");
      return { success: true };
    } catch (err) {
      console.error("[deleteContactAction] Error deleting contact:", err);
      const idx = mockContactsStore.findIndex((c) => c.id === id);
      if (idx !== -1) {
        if (!isAdminOrManager && mockContactsStore[idx].ownerId && mockContactsStore[idx].ownerId !== userId) {
          return { success: false, error: "Unauthorized: You can only delete contacts assigned to you" };
        }
        mockContactsStore.splice(idx, 1);
      }
      revalidatePath("/contacts");
      revalidatePath("/dashboard");
      return { success: true };
    }
  } catch (err: unknown) {
    const errorObj = err as { digest?: string; message?: string };
    if (errorObj?.digest?.includes?.("NEXT_REDIRECT") || errorObj?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return { success: false, error: errorObj?.message || "Failed to delete contact" };
  }
}

/**
 * Assign contact to an owner (Admin/Manager only)
 */
export async function assignContactAction(id: string, ownerId: string) {
  const session = await requireAuth();
  const roleUpper = session.role?.toUpperCase();
  const isAdminOrManager =
    roleUpper === "ADMIN" ||
    roleUpper === "ADMINISTRATOR" ||
    roleUpper === "MANAGER" ||
    Boolean(session.isSuperAdmin);

  if (!isAdminOrManager) {
    return { success: false, error: "Unauthorized: Only Admins and Managers can reassign contacts" };
  }

  try {
    const updated = await prisma.contact.update({
      where: {
        id,
        organizationId: session.organizationId,
      },
      data: {
        ownerId,
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
          action: "CONTACT_ASSIGNED",
          entityType: "Contact",
          entityId: id,
          newValues: { ownerId },
        },
      });
    } catch {}

    revalidatePath("/contacts");
    revalidatePath(`/contacts/${id}`);
    return { success: true, data: updated };
  } catch {
    const idx = mockContactsStore.findIndex((c) => c.id === id);
    if (idx !== -1) {
      const assignedUser = mockUsersStore.find((u) => u.id === ownerId);
      mockContactsStore[idx].ownerId = ownerId;
      mockContactsStore[idx].ownerName = assignedUser ? assignedUser.name : "Assigned User";
      revalidatePath("/contacts");
      revalidatePath(`/contacts/${id}`);
      return { success: true, data: mockContactsStore[idx] };
    }
    return { success: false, error: "Contact not found" };
  }
}
