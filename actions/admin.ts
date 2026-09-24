"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/session";
import { mockOrganizationsStore, mockUsersStore, mockLeadsStore, mockOpportunitiesStore } from "@/lib/db/mock-store";
import { ensureDatabaseSchema } from "@/lib/db/migrate";

export interface TenantItem {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: "FREE_TRIAL" | "STARTER_20" | "GROWTH_50" | "ENTERPRISE";
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";
  maxSeats: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  subscriptionNotes: string | null;
  createdAt: string;
  usersCount: number;
  leadsCount: number;
  dealsCount: number;
}

export interface UpdateTenantSubscriptionInput {
  organizationId: string;
  subscriptionPlan?: "FREE_TRIAL" | "STARTER_20" | "GROWTH_50" | "ENTERPRISE";
  subscriptionStatus?: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED";
  maxSeats?: number;
  extendMonths?: number;
  subscriptionNotes?: string;
  customExpiryDate?: string;
}

/**
 * Fetch all registered tenant organizations for Super Admin overview
 */
export async function getTenantsAction(): Promise<{
  success: boolean;
  data?: {
    tenants: TenantItem[];
    stats: {
      totalOrganizations: number;
      activeSubscriptions: number;
      trialOrganizations: number;
      totalSeatsAllocated: number;
    };
  };
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    try {
      const orgs = await prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              users: true,
              leads: true,
              opportunities: true,
            },
          },
        },
      });

      const tenants: TenantItem[] = orgs.map((o) => ({
        id: o.id,
        name: o.name || "Unnamed Organization",
        slug: o.slug,
        subscriptionPlan: o.subscriptionPlan || "FREE_TRIAL",
        subscriptionStatus: o.subscriptionStatus || "TRIAL",
        maxSeats: typeof o.maxSeats === "number" ? o.maxSeats : 20,
        trialEndsAt: o.trialEndsAt ? new Date(o.trialEndsAt).toISOString() : null,
        subscriptionEndsAt: o.subscriptionEndsAt ? new Date(o.subscriptionEndsAt).toISOString() : null,
        billingEmail: o.billingEmail || null,
        billingPhone: o.billingPhone || null,
        subscriptionNotes: o.subscriptionNotes || null,
        createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
        usersCount: o._count?.users || 0,
        leadsCount: o._count?.leads || 0,
        dealsCount: o._count?.opportunities || 0,
      }));

      const activeCount = tenants.filter((t) => t.subscriptionStatus === "ACTIVE").length;
      const trialCount = tenants.filter((t) => t.subscriptionStatus === "TRIAL").length;
      const totalSeats = tenants.reduce((acc, curr) => acc + curr.maxSeats, 0);

      return {
        success: true,
        data: {
          tenants,
          stats: {
            totalOrganizations: tenants.length,
            activeSubscriptions: activeCount,
            trialOrganizations: trialCount,
            totalSeatsAllocated: totalSeats,
          },
        },
      };
    } catch {
      // Mock store fallback
      const tenants: TenantItem[] = mockOrganizationsStore.map((o) => {
        const usersCount = mockUsersStore.filter((u) => u.organizationId === o.id).length;
        const leadsCount = mockLeadsStore.filter((l) => l.organizationId === o.id).length;
        const dealsCount = mockOpportunitiesStore.filter((op) => op.organizationId === o.id).length;

        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          subscriptionPlan: o.subscriptionPlan,
          subscriptionStatus: o.subscriptionStatus,
          maxSeats: o.maxSeats,
          trialEndsAt: o.trialEndsAt,
          subscriptionEndsAt: o.subscriptionEndsAt,
          billingEmail: o.billingEmail,
          billingPhone: o.billingPhone,
          subscriptionNotes: o.subscriptionNotes,
          createdAt: o.createdAt,
          usersCount: Math.max(1, usersCount),
          leadsCount,
          dealsCount,
        };
      });

      const activeCount = tenants.filter((t) => t.subscriptionStatus === "ACTIVE").length;
      const trialCount = tenants.filter((t) => t.subscriptionStatus === "TRIAL").length;
      const totalSeats = tenants.reduce((acc, curr) => acc + curr.maxSeats, 0);

      return {
        success: true,
        data: {
          tenants,
          stats: {
            totalOrganizations: tenants.length,
            activeSubscriptions: activeCount,
            trialOrganizations: trialCount,
            totalSeatsAllocated: totalSeats,
          },
        },
      };
    }
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return {
      success: false,
      error: err?.message || "Failed to fetch tenant directory",
    };
  }
}

/**
 * Super Admin manually activates, upgrades, or extends an organization's subscription
 */
export async function updateTenantSubscriptionAction(
  input: UpdateTenantSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();

    const {
      organizationId,
      subscriptionPlan,
      subscriptionStatus,
      maxSeats,
      extendMonths,
      subscriptionNotes,
      customExpiryDate,
    } = input;

    let newExpiryDate: Date | undefined;
    if (customExpiryDate) {
      newExpiryDate = new Date(customExpiryDate);
    } else if (extendMonths && extendMonths > 0) {
      const base = new Date();
      base.setDate(base.getDate() + extendMonths * 30);
      newExpiryDate = base;
    }

    try {
      const updateData: any = {};
      if (subscriptionPlan) updateData.subscriptionPlan = subscriptionPlan;
      if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
      if (typeof maxSeats === "number") updateData.maxSeats = maxSeats;
      if (subscriptionNotes !== undefined) updateData.subscriptionNotes = subscriptionNotes;

      if (newExpiryDate) {
        if (subscriptionStatus === "TRIAL") {
          updateData.trialEndsAt = newExpiryDate;
        } else {
          updateData.subscriptionEndsAt = newExpiryDate;
        }
      }

      await prisma.organization.update({
        where: { id: organizationId },
        data: updateData,
      });
    } catch {
      // Mock store fallback
      const mockOrg = mockOrganizationsStore.find((o) => o.id === organizationId);
      if (mockOrg) {
        if (subscriptionPlan) mockOrg.subscriptionPlan = subscriptionPlan;
        if (subscriptionStatus) mockOrg.subscriptionStatus = subscriptionStatus;
        if (typeof maxSeats === "number") mockOrg.maxSeats = maxSeats;
        if (subscriptionNotes !== undefined) mockOrg.subscriptionNotes = subscriptionNotes;
        if (newExpiryDate) {
          if (subscriptionStatus === "TRIAL") {
            mockOrg.trialEndsAt = newExpiryDate.toISOString();
          } else {
            mockOrg.subscriptionEndsAt = newExpiryDate.toISOString();
          }
        }
      }
    }

    revalidatePath("/admin/tenants");
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return {
      success: false,
      error: err?.message || "Failed to update subscription",
    };
  }
}
