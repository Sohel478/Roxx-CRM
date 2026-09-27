"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireSuperAdmin } from "@/lib/auth/session";
import {
  mockOrganizationsStore,
  mockUsersStore,
  mockLeadsStore,
  mockOpportunitiesStore,
  mockCompaniesStore,
  mockContactsStore,
  mockPlansStore,
  mockSubscriptionsStore,
  mockSubscriptionEventsStore,
  mockPaymentsStore,
  mockAuditLogsStore,
} from "@/lib/db/mock-store";
import { ensureDatabaseSchema } from "@/lib/db/migrate";
import { SubscriptionService } from "@/lib/subscription/subscription-service";
import type {
  TenantItem,
  UpdateTenantSubscriptionInput,
  SuperAdminDashboardMetrics,
  SuperAdminPlanItem,
  CreatePlanInput,
  UpdatePlanInput,
  SuperAdminSubscriptionItem,
  SuperAdminPaymentItem,
  TenantDetailData,
  SuperAdminAuditLogItem,
  SuperAdminUsageItem,
  SuperAdminPlatformSettings,
} from "@/lib/validations/admin";

function isMockMode(): boolean {
  return (
    !process.env.DATABASE_URL ||
    process.env.DATABASE_URL.includes("ep-sample-pooler") ||
    process.env.DATABASE_URL.includes("user:password")
  );
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

    if (isMockMode()) {
      const tenants: TenantItem[] = mockOrganizationsStore.map((o) => {
        const usersCount = mockUsersStore.filter((u) => u.organizationId === o.id).length;
        const leadsCount = mockLeadsStore.filter((l) => l.organizationId === o.id).length;
        const dealsCount = mockOpportunitiesStore.filter((op) => op.organizationId === o.id).length;

        return {
          id: o.id,
          name: o.name,
          slug: o.slug,
          subscriptionPlan: o.subscriptionPlan,
          subscriptionStatus: o.subscriptionStatus as any,
          maxSeats: o.maxSeats,
          trialEndsAt: o.trialEndsAt,
          subscriptionEndsAt: o.subscriptionEndsAt,
          billingEmail: o.billingEmail,
          billingPhone: o.billingPhone,
          subscriptionNotes: o.subscriptionNotes,
          isDemo: Boolean(o.isDemo),
          website: o.website || null,
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
        subscriptionPlan: String(o.subscriptionPlan || "FREE_TRIAL"),
        subscriptionStatus: (o.subscriptionStatus as any) || "TRIAL",
        maxSeats: typeof o.maxSeats === "number" ? o.maxSeats : 20,
        trialEndsAt: o.trialEndsAt ? new Date(o.trialEndsAt).toISOString() : null,
        subscriptionEndsAt: o.subscriptionEndsAt ? new Date(o.subscriptionEndsAt).toISOString() : null,
        billingEmail: o.billingEmail || null,
        billingPhone: o.billingPhone || null,
        subscriptionNotes: o.subscriptionNotes || null,
        isDemo: Boolean(o.isDemo),
        website: o.website || null,
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
      // Fallback
      return {
        success: true,
        data: {
          tenants: [],
          stats: {
            totalOrganizations: 0,
            activeSubscriptions: 0,
            trialOrganizations: 0,
            totalSeatsAllocated: 0,
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
 * Fetch complete dashboard KPIs, MRR, and distributions for Super Admin
 */
export async function getSuperAdminDashboardMetricsAction(): Promise<{
  success: boolean;
  data?: SuperAdminDashboardMetrics;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    const tenantsResult = await getTenantsAction();
    const tenants = tenantsResult.data?.tenants || [];

    let totalUsers = 0;
    let totalLeads = 0;
    let totalOpportunities = 0;

    tenants.forEach((t) => {
      totalUsers += t.usersCount;
      totalLeads += t.leadsCount;
      totalOpportunities += t.dealsCount;
    });

    const activeOrgs = tenants.filter((t) => t.subscriptionStatus === "ACTIVE");
    const trialOrgs = tenants.filter((t) => t.subscriptionStatus === "TRIAL");
    const expiredOrgs = tenants.filter((t) => t.subscriptionStatus === "EXPIRED");
    const suspendedOrgs = tenants.filter((t) => t.subscriptionStatus === "SUSPENDED");

    // Calculate MRR based on plans
    const planPrices: Record<string, number> = {
      FREE_TRIAL: 0,
      starter: 29,
      STARTER_20: 29,
      professional: 79,
      GROWTH_50: 79,
      business: 199,
      ENTERPRISE: 499,
      enterprise: 499,
    };

    let mrr = 0;
    const planCountMap: Record<string, number> = {};

    tenants.forEach((t) => {
      const planKey = (t.subscriptionPlan || "FREE_TRIAL").toLowerCase();
      planCountMap[t.subscriptionPlan] = (planCountMap[t.subscriptionPlan] || 0) + 1;
      if (t.subscriptionStatus === "ACTIVE") {
        mrr += planPrices[planKey] || planPrices[t.subscriptionPlan] || 29;
      }
    });

    const planDistribution = Object.entries(planCountMap).map(([plan, count]) => ({
      plan: plan.replace("_", " "),
      count,
    }));

    return {
      success: true,
      data: {
        totalOrganizations: tenants.length,
        activeOrganizations: activeOrgs.length,
        trialOrganizations: trialOrgs.length,
        expiredOrganizations: expiredOrgs.length,
        suspendedOrganizations: suspendedOrgs.length,
        totalUsers: Math.max(totalUsers, tenants.length),
        totalLeads,
        totalOpportunities,
        mrr,
        planDistribution,
        recentTenants: tenants.slice(0, 5),
      },
    };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return {
      success: false,
      error: err?.message || "Failed to load super admin metrics",
    };
  }
}

/**
 * Fetch detailed tenant dossier (info, subscription, limits, users, audit logs)
 */
export async function getTenantDetailAction(organizationId: string): Promise<{
  success: boolean;
  data?: TenantDetailData;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const org =
        mockOrganizationsStore.find((o) => o.id === organizationId) ||
        mockOrganizationsStore[0];
      const users = mockUsersStore.filter((u) => u.organizationId === org.id);
      const usage = await SubscriptionService.getUsage(org.id);
      const events = mockSubscriptionEventsStore.filter((e) => e.organizationId === org.id);
      const audit = mockAuditLogsStore.filter((a) => a.organizationId === org.id);

      return {
        success: true,
        data: {
          organization: {
            id: org.id,
            name: org.name,
            slug: org.slug,
            subscriptionPlan: org.subscriptionPlan,
            subscriptionStatus: org.subscriptionStatus as any,
            maxSeats: org.maxSeats,
            trialEndsAt: org.trialEndsAt,
            subscriptionEndsAt: org.subscriptionEndsAt,
            billingEmail: org.billingEmail,
            billingPhone: org.billingPhone,
            subscriptionNotes: org.subscriptionNotes,
            isDemo: Boolean(org.isDemo),
            website: org.website || null,
            createdAt: org.createdAt,
            usersCount: users.length,
            leadsCount: mockLeadsStore.filter((l) => l.organizationId === org.id).length,
            dealsCount: mockOpportunitiesStore.filter((o) => o.organizationId === org.id).length,
          },
          users: users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            isActive: u.isActive,
            createdAt: u.createdAt,
          })),
          usage: {
            users: { current: usage.usage.users.current, limit: usage.usage.users.limit },
            leads: { current: usage.usage.leads.current, limit: usage.usage.leads.limit },
            companies: { current: usage.usage.companies.current, limit: usage.usage.companies.limit },
            contacts: { current: usage.usage.contacts.current, limit: usage.usage.contacts.limit },
            opportunities: { current: usage.usage.opportunities.current, limit: usage.usage.opportunities.limit },
          },
          events: events.map((e) => ({
            id: e.id,
            eventType: e.eventType,
            notes: e.notes,
            createdAt: e.createdAt,
          })),
          auditLogs: audit.map((a) => ({
            id: a.id,
            action: a.action,
            entityType: a.entityType,
            entityId: a.entityId,
            createdAt: a.createdAt,
          })),
        },
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: {
          include: { role: true },
          orderBy: { createdAt: "asc" },
        },
        subscriptionEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            users: true,
            leads: true,
            companies: true,
            contacts: true,
            opportunities: true,
          },
        },
      },
    });

    if (!org) {
      return { success: false, error: "Organization not found" };
    }

    const usage = await SubscriptionService.getUsage(org.id);

    return {
      success: true,
      data: {
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          subscriptionPlan: String(org.subscriptionPlan),
          subscriptionStatus: org.subscriptionStatus as any,
          maxSeats: org.maxSeats,
          trialEndsAt: org.trialEndsAt ? org.trialEndsAt.toISOString() : null,
          subscriptionEndsAt: org.subscriptionEndsAt ? org.subscriptionEndsAt.toISOString() : null,
          billingEmail: org.billingEmail || null,
          billingPhone: org.billingPhone || null,
          subscriptionNotes: org.subscriptionNotes || null,
          isDemo: Boolean(org.isDemo),
          website: org.website || null,
          createdAt: org.createdAt.toISOString(),
          usersCount: org._count.users,
          leadsCount: org._count.leads,
          dealsCount: org._count.opportunities,
        },
        users: org.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role?.name || "User",
          isActive: u.isActive,
          createdAt: u.createdAt.toISOString(),
        })),
        usage: {
          users: { current: usage.usage.users.current, limit: usage.usage.users.limit },
          leads: { current: usage.usage.leads.current, limit: usage.usage.leads.limit },
          companies: { current: usage.usage.companies.current, limit: usage.usage.companies.limit },
          contacts: { current: usage.usage.contacts.current, limit: usage.usage.contacts.limit },
          opportunities: { current: usage.usage.opportunities.current, limit: usage.usage.opportunities.limit },
        },
        events: org.subscriptionEvents.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          notes: e.notes,
          createdAt: e.createdAt.toISOString(),
        })),
        auditLogs: org.auditLogs.map((a) => ({
          id: a.id,
          action: a.action,
          entityType: a.entityType,
          entityId: a.entityId,
          createdAt: a.createdAt.toISOString(),
        })),
      },
    };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") {
      throw err;
    }
    return {
      success: false,
      error: err?.message || "Failed to load organization details",
    };
  }
}

/**
 * Super Admin suspends an organization (locks write access, preserves data)
 */
export async function suspendOrganizationAction(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const org = mockOrganizationsStore.find((o) => o.id === organizationId);
      if (org) {
        org.subscriptionStatus = "SUSPENDED";
      }
      mockSubscriptionEventsStore.unshift({
        id: `evt_${Date.now()}`,
        subscriptionId: `sub_${organizationId}`,
        organizationId,
        eventType: "SUSPENDED",
        oldPlanId: null,
        newPlanId: null,
        notes: "Organization suspended by Super Administrator",
        createdBy: session.id,
        createdAt: new Date().toISOString(),
      });
      return { success: true };
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: "SUSPENDED" },
    });

    const activeSub = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    if (activeSub) {
      await prisma.subscription.update({
        where: { id: activeSub.id },
        data: { status: "SUSPENDED" },
      });

      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: activeSub.id,
          organizationId,
          eventType: "SUSPENDED",
          notes: "Organization suspended by Super Administrator",
          createdBy: session.id,
        },
      });
    }

    revalidatePath("/super-admin/organizations");
    revalidatePath(`/super-admin/organizations/${organizationId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to suspend organization" };
  }
}

/**
 * Super Admin activates an organization
 */
export async function activateOrganizationAction(
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const org = mockOrganizationsStore.find((o) => o.id === organizationId);
      if (org) {
        org.subscriptionStatus = "ACTIVE";
      }
      mockSubscriptionEventsStore.unshift({
        id: `evt_${Date.now()}`,
        subscriptionId: `sub_${organizationId}`,
        organizationId,
        eventType: "ACTIVATED",
        oldPlanId: null,
        newPlanId: null,
        notes: "Organization activated by Super Administrator",
        createdBy: session.id,
        createdAt: new Date().toISOString(),
      });
      return { success: true };
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: { subscriptionStatus: "ACTIVE" },
    });

    const activeSub = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    if (activeSub) {
      await prisma.subscription.update({
        where: { id: activeSub.id },
        data: { status: "ACTIVE" },
      });

      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: activeSub.id,
          organizationId,
          eventType: "ACTIVATED",
          notes: "Organization reactivated by Super Administrator",
          createdBy: session.id,
        },
      });
    }

    revalidatePath("/super-admin/organizations");
    revalidatePath(`/super-admin/organizations/${organizationId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to activate organization" };
  }
}

/**
 * Super Admin extends trial by specified days
 */
export async function extendTrialAction(
  organizationId: string,
  days: number = 14
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await requireSuperAdmin();
    await ensureDatabaseSchema();

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + days);

    if (isMockMode()) {
      const org = mockOrganizationsStore.find((o) => o.id === organizationId);
      if (org) {
        org.subscriptionStatus = "TRIAL";
        org.trialEndsAt = newExpiry.toISOString();
      }
      mockSubscriptionEventsStore.unshift({
        id: `evt_${Date.now()}`,
        subscriptionId: `sub_${organizationId}`,
        organizationId,
        eventType: "TRIAL_EXTENDED",
        oldPlanId: null,
        newPlanId: null,
        notes: `Free trial extended by ${days} days by Super Administrator`,
        createdBy: session.id,
        createdAt: new Date().toISOString(),
      });
      return { success: true };
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        subscriptionStatus: "TRIAL",
        trialEndsAt: newExpiry,
      },
    });

    const sub = await prisma.subscription.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: "TRIAL",
          trialEndDate: newExpiry,
        },
      });

      await prisma.subscriptionEvent.create({
        data: {
          subscriptionId: sub.id,
          organizationId,
          eventType: "TRIAL_EXTENDED",
          notes: `Free trial extended by ${days} days by Super Administrator`,
          createdBy: session.id,
        },
      });
    }

    revalidatePath("/super-admin/organizations");
    revalidatePath(`/super-admin/organizations/${organizationId}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to extend trial" };
  }
}

/**
 * Super Admin manually updates an organization's subscription
 */
export async function updateTenantSubscriptionAction(
  input: UpdateTenantSubscriptionInput
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

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

    if (isMockMode()) {
      const mockOrg = mockOrganizationsStore.find((o) => o.id === organizationId);
      if (mockOrg) {
        if (subscriptionPlan) mockOrg.subscriptionPlan = subscriptionPlan as any;
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
      return { success: true };
    }

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

    revalidatePath("/super-admin/organizations");
    revalidatePath(`/super-admin/organizations/${organizationId}`);
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

/**
 * Fetch all SaaS plans for plan management
 */
export async function getSuperAdminPlansAction(): Promise<{
  success: boolean;
  data?: SuperAdminPlanItem[];
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const plans: SuperAdminPlanItem[] = mockPlansStore.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description,
        price: p.price,
        currency: p.currency,
        billingInterval: p.billingInterval,
        isActive: p.isActive,
        isPublic: p.isPublic,
        features: {
          users_limit: parseInt(p.features.users_limit || "3", 10),
          leads_limit: parseInt(p.features.leads_limit || "1000", 10),
          companies_limit: parseInt(p.features.companies_limit || "500", 10),
          contacts_limit: parseInt(p.features.contacts_limit || "1000", 10),
          opportunities_limit: parseInt(p.features.opportunities_limit || "500", 10),
          pipelines_limit: parseInt(p.features.pipelines_limit || "1", 10),
          advanced_reports: p.features.advanced_reports === "true",
          export: p.features.export === "true",
          api_access: p.features.api_access === "true",
          ai_features: p.features.ai_features === "true",
        },
        activeSubscriptionsCount: 1,
      }));
      return { success: true, data: plans };
    }

    const plans = await prisma.plan.findMany({
      orderBy: { price: "asc" },
      include: {
        features: true,
        _count: {
          select: { subscriptions: true },
        },
      },
    });

    const mapped: SuperAdminPlanItem[] = plans.map((p) => {
      const featMap: Record<string, any> = {};
      p.features.forEach((f) => {
        if (f.featureValue === "true") featMap[f.featureKey] = true;
        else if (f.featureValue === "false") featMap[f.featureKey] = false;
        else featMap[f.featureKey] = Number(f.featureValue) || 0;
      });

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        description: p.description || "",
        price: Number(p.price),
        currency: p.currency,
        billingInterval: p.billingInterval,
        isActive: p.isActive,
        isPublic: p.isPublic,
        features: {
          users_limit: featMap.users_limit || 3,
          leads_limit: featMap.leads_limit || 1000,
          companies_limit: featMap.companies_limit || 500,
          contacts_limit: featMap.contacts_limit || 1000,
          opportunities_limit: featMap.opportunities_limit || 500,
          pipelines_limit: featMap.pipelines_limit || 1,
          advanced_reports: Boolean(featMap.advanced_reports),
          export: Boolean(featMap.export),
          api_access: Boolean(featMap.api_access),
          ai_features: Boolean(featMap.ai_features),
        },
        activeSubscriptionsCount: p._count.subscriptions,
      };
    });

    return { success: true, data: mapped };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load plans" };
  }
}

/**
 * Create a new SaaS plan tier
 */
export async function createSuperAdminPlanAction(input: CreatePlanInput): Promise<{
  success: boolean;
  data?: SuperAdminPlanItem;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (!input.name?.trim()) {
      return { success: false, error: "Plan name is required" };
    }

    const slug = (
      input.slug?.trim() ||
      input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    );

    if (isMockMode()) {
      const exists = mockPlansStore.some((p) => p.slug.toLowerCase() === slug.toLowerCase());
      if (exists) {
        return { success: false, error: `Plan slug '${slug}' already exists` };
      }

      const newId = `plan_${Date.now()}`;
      const mockPlan = {
        id: newId,
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || "",
        price: Number(input.price) || 0,
        currency: input.currency || "USD",
        billingInterval: input.billingInterval || "MONTHLY",
        isActive: input.isActive ?? true,
        isPublic: input.isPublic ?? true,
        features: {
          users_limit: String(input.features.users_limit ?? 3),
          leads_limit: String(input.features.leads_limit ?? 1000),
          companies_limit: String(input.features.companies_limit ?? 500),
          contacts_limit: String(input.features.contacts_limit ?? 1000),
          opportunities_limit: String(input.features.opportunities_limit ?? 500),
          pipelines_limit: String(input.features.pipelines_limit ?? 1),
          advanced_reports: String(Boolean(input.features.advanced_reports)),
          export: String(Boolean(input.features.export)),
          api_access: String(Boolean(input.features.api_access)),
          ai_features: String(Boolean(input.features.ai_features)),
        },
        createdAt: new Date().toISOString(),
      };

      mockPlansStore.push(mockPlan);

      revalidatePath("/super-admin/plans");
      revalidatePath("/pricing");

      return {
        success: true,
        data: {
          id: newId,
          name: mockPlan.name,
          slug: mockPlan.slug,
          description: mockPlan.description,
          price: mockPlan.price,
          currency: mockPlan.currency,
          billingInterval: mockPlan.billingInterval,
          isActive: mockPlan.isActive,
          isPublic: mockPlan.isPublic,
          features: {
            users_limit: Number(mockPlan.features.users_limit),
            leads_limit: Number(mockPlan.features.leads_limit),
            companies_limit: Number(mockPlan.features.companies_limit),
            contacts_limit: Number(mockPlan.features.contacts_limit),
            opportunities_limit: Number(mockPlan.features.opportunities_limit),
            pipelines_limit: Number(mockPlan.features.pipelines_limit),
            advanced_reports: mockPlan.features.advanced_reports === "true",
            export: mockPlan.features.export === "true",
            api_access: mockPlan.features.api_access === "true",
            ai_features: mockPlan.features.ai_features === "true",
          },
          activeSubscriptionsCount: 0,
        },
      };
    }

    // Prisma Mode
    const existing = await prisma.plan.findUnique({ where: { slug } });
    if (existing) {
      return { success: false, error: `Plan slug '${slug}' already exists` };
    }

    const featureEntries = [
      { featureKey: "users_limit", featureValue: String(input.features.users_limit ?? 3) },
      { featureKey: "leads_limit", featureValue: String(input.features.leads_limit ?? 1000) },
      { featureKey: "companies_limit", featureValue: String(input.features.companies_limit ?? 500) },
      { featureKey: "contacts_limit", featureValue: String(input.features.contacts_limit ?? 1000) },
      { featureKey: "opportunities_limit", featureValue: String(input.features.opportunities_limit ?? 500) },
      { featureKey: "pipelines_limit", featureValue: String(input.features.pipelines_limit ?? 1) },
      { featureKey: "advanced_reports", featureValue: String(Boolean(input.features.advanced_reports)) },
      { featureKey: "export", featureValue: String(Boolean(input.features.export)) },
      { featureKey: "api_access", featureValue: String(Boolean(input.features.api_access)) },
      { featureKey: "ai_features", featureValue: String(Boolean(input.features.ai_features)) },
    ];

    const plan = await prisma.plan.create({
      data: {
        name: input.name.trim(),
        slug,
        description: input.description?.trim() || "",
        price: Number(input.price) || 0,
        currency: input.currency || "USD",
        billingInterval: input.billingInterval || "MONTHLY",
        isActive: input.isActive ?? true,
        isPublic: input.isPublic ?? true,
        features: {
          create: featureEntries,
        },
      },
      include: {
        features: true,
      },
    });

    revalidatePath("/super-admin/plans");
    revalidatePath("/pricing");

    return {
      success: true,
      data: {
        id: plan.id,
        name: plan.name,
        slug: plan.slug,
        description: plan.description || "",
        price: Number(plan.price),
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        isActive: plan.isActive,
        isPublic: plan.isPublic,
        features: {
          users_limit: input.features.users_limit ?? 3,
          leads_limit: input.features.leads_limit ?? 1000,
          companies_limit: input.features.companies_limit ?? 500,
          contacts_limit: input.features.contacts_limit ?? 1000,
          opportunities_limit: input.features.opportunities_limit ?? 500,
          pipelines_limit: input.features.pipelines_limit ?? 1,
          advanced_reports: Boolean(input.features.advanced_reports),
          export: Boolean(input.features.export),
          api_access: Boolean(input.features.api_access),
          ai_features: Boolean(input.features.ai_features),
        },
        activeSubscriptionsCount: 0,
      },
    };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") throw err;
    return { success: false, error: err.message || "Failed to create plan" };
  }
}

/**
 * Update an existing SaaS plan tier
 */
export async function updateSuperAdminPlanAction(
  planId: string,
  input: UpdatePlanInput
): Promise<{
  success: boolean;
  data?: SuperAdminPlanItem;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const idx = mockPlansStore.findIndex((p) => p.id === planId || p.slug === planId);
      if (idx === -1) {
        return { success: false, error: "Plan not found" };
      }

      const p = mockPlansStore[idx];
      if (input.name) p.name = input.name.trim();
      if (input.slug) p.slug = input.slug.trim();
      if (input.description !== undefined) p.description = input.description.trim();
      if (input.price !== undefined) p.price = Number(input.price);
      if (input.currency) p.currency = input.currency;
      if (input.billingInterval) p.billingInterval = input.billingInterval;
      if (input.isActive !== undefined) p.isActive = input.isActive;
      if (input.isPublic !== undefined) p.isPublic = input.isPublic;

      if (input.features) {
        Object.entries(input.features).forEach(([k, v]) => {
          if (v !== undefined) {
            (p.features as Record<string, string>)[k] = String(v);
          }
        });
      }

      revalidatePath("/super-admin/plans");
      revalidatePath("/pricing");

      return {
        success: true,
        data: {
          id: p.id,
          name: p.name,
          slug: p.slug,
          description: p.description,
          price: p.price,
          currency: p.currency,
          billingInterval: p.billingInterval,
          isActive: p.isActive,
          isPublic: p.isPublic,
          features: {
            users_limit: parseInt(p.features.users_limit || "3", 10),
            leads_limit: parseInt(p.features.leads_limit || "1000", 10),
            companies_limit: parseInt(p.features.companies_limit || "500", 10),
            contacts_limit: parseInt(p.features.contacts_limit || "1000", 10),
            opportunities_limit: parseInt(p.features.opportunities_limit || "500", 10),
            pipelines_limit: parseInt(p.features.pipelines_limit || "1", 10),
            advanced_reports: p.features.advanced_reports === "true",
            export: p.features.export === "true",
            api_access: p.features.api_access === "true",
            ai_features: p.features.ai_features === "true",
          },
          activeSubscriptionsCount: 1,
        },
      };
    }

    // Prisma Mode
    const existing = await prisma.plan.findUnique({
      where: { id: planId },
      include: { features: true, _count: { select: { subscriptions: true } } },
    });

    if (!existing) {
      return { success: false, error: "Plan not found" };
    }

    const updatedPlan = await prisma.plan.update({
      where: { id: planId },
      data: {
        ...(input.name && { name: input.name.trim() }),
        ...(input.slug && { slug: input.slug.trim() }),
        ...(input.description !== undefined && { description: input.description.trim() }),
        ...(input.price !== undefined && { price: Number(input.price) }),
        ...(input.currency && { currency: input.currency }),
        ...(input.billingInterval && { billingInterval: input.billingInterval }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.isPublic !== undefined && { isPublic: input.isPublic }),
      },
    });

    if (input.features) {
      for (const [key, val] of Object.entries(input.features)) {
        if (val !== undefined) {
          await prisma.planFeature.upsert({
            where: {
              planId_featureKey: {
                planId,
                featureKey: key,
              },
            },
            update: { featureValue: String(val) },
            create: {
              planId,
              featureKey: key,
              featureValue: String(val),
            },
          });
        }
      }
    }

    revalidatePath("/super-admin/plans");
    revalidatePath("/pricing");

    const refreshed = await prisma.plan.findUnique({
      where: { id: planId },
      include: { features: true, _count: { select: { subscriptions: true } } },
    });

    const featMap: Record<string, any> = {};
    refreshed?.features.forEach((f) => {
      if (f.featureValue === "true") featMap[f.featureKey] = true;
      else if (f.featureValue === "false") featMap[f.featureKey] = false;
      else featMap[f.featureKey] = Number(f.featureValue) || 0;
    });

    return {
      success: true,
      data: {
        id: updatedPlan.id,
        name: updatedPlan.name,
        slug: updatedPlan.slug,
        description: updatedPlan.description || "",
        price: Number(updatedPlan.price),
        currency: updatedPlan.currency,
        billingInterval: updatedPlan.billingInterval,
        isActive: updatedPlan.isActive,
        isPublic: updatedPlan.isPublic,
        features: {
          users_limit: featMap.users_limit || 3,
          leads_limit: featMap.leads_limit || 1000,
          companies_limit: featMap.companies_limit || 500,
          contacts_limit: featMap.contacts_limit || 1000,
          opportunities_limit: featMap.opportunities_limit || 500,
          pipelines_limit: featMap.pipelines_limit || 1,
          advanced_reports: Boolean(featMap.advanced_reports),
          export: Boolean(featMap.export),
          api_access: Boolean(featMap.api_access),
          ai_features: Boolean(featMap.ai_features),
        },
        activeSubscriptionsCount: refreshed?._count?.subscriptions || 0,
      },
    };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") throw err;
    return { success: false, error: err.message || "Failed to update plan" };
  }
}

/**
 * Delete a SaaS plan tier
 */
export async function deleteSuperAdminPlanAction(planId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const idx = mockPlansStore.findIndex((p) => p.id === planId || p.slug === planId);
      if (idx === -1) {
        return { success: false, error: "Plan not found" };
      }

      const targetPlan = mockPlansStore[idx];
      const hasActiveSubs = mockSubscriptionsStore.some(
        (s) => s.planId === targetPlan.id || s.planId === targetPlan.slug
      );
      if (hasActiveSubs) {
        return {
          success: false,
          error: "Cannot delete plan with active subscriptions. You can mark it inactive instead.",
        };
      }

      mockPlansStore.splice(idx, 1);

      revalidatePath("/super-admin/plans");
      revalidatePath("/pricing");
      return { success: true };
    }

    // Prisma Mode
    const plan = await prisma.plan.findUnique({
      where: { id: planId },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    if (!plan) {
      return { success: false, error: "Plan not found" };
    }

    if (plan._count.subscriptions > 0) {
      return {
        success: false,
        error: `Cannot delete plan '${plan.name}' because ${plan._count.subscriptions} active subscription(s) are currently attached. You can set it to inactive instead.`,
      };
    }

    await prisma.plan.delete({
      where: { id: planId },
    });

    revalidatePath("/super-admin/plans");
    revalidatePath("/pricing");
    return { success: true };
  } catch (err: any) {
    if (err?.digest?.includes?.("NEXT_REDIRECT") || err?.message === "NEXT_REDIRECT") throw err;
    return { success: false, error: err.message || "Failed to delete plan" };
  }
}

/**
 * Fetch all payments for Super Admin ledger
 */
export async function getSuperAdminPaymentsAction(): Promise<{
  success: boolean;
  data?: SuperAdminPaymentItem[];
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      return {
        success: true,
        data: mockPaymentsStore.map((p) => ({
          id: p.id,
          organizationId: p.organizationId,
          organizationName: "Demo Company",
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          provider: p.provider,
          externalPaymentId: p.externalPaymentId,
          createdAt: p.createdAt,
        })),
      };
    }

    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organization: {
          select: { name: true },
        },
      },
      take: 50,
    });

    return {
      success: true,
      data: payments.map((p) => ({
        id: p.id,
        organizationId: p.organizationId,
        organizationName: p.organization?.name || "Unknown Organization",
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        provider: p.provider,
        externalPaymentId: p.externalPaymentId,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load payments" };
  }
}

/**
 * Fetch all subscriptions with related event logs
 */
export async function getSuperAdminSubscriptionsAction(): Promise<{
  success: boolean;
  data?: {
    subscriptions: SuperAdminSubscriptionItem[];
    events: {
      id: string;
      subscriptionId: string;
      organizationId: string;
      organizationName: string;
      eventType: string;
      notes: string | null;
      createdAt: string;
    }[];
  };
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      const subs: SuperAdminSubscriptionItem[] = mockSubscriptionsStore.map((s) => {
        const org = mockOrganizationsStore.find((o) => o.id === s.organizationId);
        const plan = mockPlansStore.find((p) => p.id === s.planId);
        const eventsCount = mockSubscriptionEventsStore.filter((e) => e.subscriptionId === s.id).length;

        return {
          id: s.id,
          organizationId: s.organizationId,
          organizationName: org?.name || "Demo Company",
          planName: plan?.name || "Professional",
          status: s.status,
          startDate: s.startDate,
          endDate: s.endDate,
          trialEndDate: s.trialEndDate,
          renewalDate: s.renewalDate,
          billingInterval: s.billingInterval,
          createdAt: s.createdAt,
          eventsCount,
        };
      });

      const events = mockSubscriptionEventsStore.map((e) => {
        const org = mockOrganizationsStore.find((o) => o.id === e.organizationId);
        return {
          id: e.id,
          subscriptionId: e.subscriptionId,
          organizationId: e.organizationId,
          organizationName: org?.name || "Demo Company",
          eventType: e.eventType,
          notes: e.notes,
          createdAt: e.createdAt,
        };
      });

      return { success: true, data: { subscriptions: subs, events } };
    }

    const subscriptions = await prisma.subscription.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
        _count: { select: { events: true } },
      },
      take: 50,
    });

    const events = await prisma.subscriptionEvent.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { id: true, name: true } },
      },
      take: 50,
    });

    return {
      success: true,
      data: {
        subscriptions: subscriptions.map((s) => ({
          id: s.id,
          organizationId: s.organizationId,
          organizationName: s.organization.name,
          planName: s.plan.name,
          status: s.status,
          startDate: s.startDate.toISOString(),
          endDate: s.endDate ? s.endDate.toISOString() : null,
          trialEndDate: s.trialEndDate ? s.trialEndDate.toISOString() : null,
          renewalDate: s.renewalDate ? s.renewalDate.toISOString() : null,
          billingInterval: s.billingInterval,
          createdAt: s.createdAt.toISOString(),
          eventsCount: s._count.events,
        })),
        events: events.map((e) => ({
          id: e.id,
          subscriptionId: e.subscriptionId,
          organizationId: e.organizationId,
          organizationName: e.organization.name,
          eventType: e.eventType,
          notes: e.notes,
          createdAt: e.createdAt.toISOString(),
        })),
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load subscriptions" };
  }
}

/**
 * Fetch platform-wide audit logs
 */
export async function getSuperAdminAuditLogsAction(): Promise<{
  success: boolean;
  data?: SuperAdminAuditLogItem[];
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      return {
        success: true,
        data: mockAuditLogsStore.map((a) => {
          const org = mockOrganizationsStore.find((o) => o.id === a.organizationId);
          const user = mockUsersStore.find((u) => u.id === a.userId);
          return {
            id: a.id,
            organizationId: a.organizationId,
            organizationName: org?.name || "System",
            userId: a.userId,
            userName: user?.name || "System Administrator",
            action: a.action,
            entityType: a.entityType,
            entityId: a.entityId,
            details: a.newValues ? JSON.stringify(a.newValues) : null,
            createdAt: a.createdAt,
          };
        }),
      };
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        organization: { select: { name: true } },
        user: { select: { name: true } },
      },
      take: 100,
    });

    return {
      success: true,
      data: logs.map((l) => ({
        id: l.id,
        organizationId: l.organizationId,
        organizationName: l.organization?.name || "System",
        userId: l.userId,
        userName: l.user?.name || "System User",
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        details: l.newValues ? JSON.stringify(l.newValues) : null,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load audit logs" };
  }
}

/**
 * Fetch aggregate resource usage and analytics across all tenants
 */
export async function getSuperAdminUsageAction(): Promise<{
  success: boolean;
  data?: {
    items: SuperAdminUsageItem[];
    summary: {
      totalOrganizations: number;
      totalUsers: number;
      totalLeads: number;
      totalOpportunities: number;
      totalStorageEstimateMb: number;
    };
  };
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    const tenantsResult = await getTenantsAction();
    const tenants = tenantsResult.data?.tenants || [];

    const items: SuperAdminUsageItem[] = await Promise.all(
      tenants.map(async (t) => {
        const usage = await SubscriptionService.getUsage(t.id);
        const companiesCount = isMockMode()
          ? mockCompaniesStore.filter((c) => c.organizationId === t.id).length
          : await prisma.company.count({ where: { organizationId: t.id } }).catch(() => 0);
        const contactsCount = isMockMode()
          ? mockContactsStore.filter((c) => c.organizationId === t.id).length
          : await prisma.contact.count({ where: { organizationId: t.id } }).catch(() => 0);

        // Approximate 1.5KB per record
        const totalRecords = t.leadsCount + t.dealsCount + companiesCount + contactsCount;
        const storageEstimateMb = Math.round((totalRecords * 1.5) / 1024 * 10) / 10;

        return {
          organizationId: t.id,
          organizationName: t.name,
          planName: t.subscriptionPlan,
          status: t.subscriptionStatus,
          usersCount: usage.usage.users.current,
          usersLimit: usage.usage.users.limit,
          leadsCount: usage.usage.leads.current,
          leadsLimit: usage.usage.leads.limit,
          opportunitiesCount: usage.usage.opportunities.current,
          opportunitiesLimit: usage.usage.opportunities.limit,
          companiesCount,
          contactsCount,
          storageEstimateMb: Math.max(storageEstimateMb, 0.1),
        };
      })
    );

    const summary = {
      totalOrganizations: items.length,
      totalUsers: items.reduce((acc, i) => acc + i.usersCount, 0),
      totalLeads: items.reduce((acc, i) => acc + i.leadsCount, 0),
      totalOpportunities: items.reduce((acc, i) => acc + i.opportunitiesCount, 0),
      totalStorageEstimateMb: Math.round(items.reduce((acc, i) => acc + i.storageEstimateMb, 0) * 10) / 10,
    };

    return { success: true, data: { items, summary } };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load usage data" };
  }
}

/**
 * Fetch platform system settings
 */
export async function getPlatformSettingsAction(): Promise<{
  success: boolean;
  data?: SuperAdminPlatformSettings;
  error?: string;
}> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    // Default configuration
    const defaults: SuperAdminPlatformSettings = {
      platformName: "Roxx CRM",
      supportEmail: "support@roxx-crm.com",
      currency: "USD",
      defaultTrialDays: 30,
      allowPublicSignup: true,
      paymentProvider: process.env.STRIPE_SECRET_KEY ? "stripe" : "mock",
      stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
      stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    };

    if (isMockMode()) {
      return { success: true, data: defaults };
    }

    try {
      const settings = await prisma.platformSetting.findMany();
      const map: Record<string, string> = {};
      settings.forEach((s) => {
        map[s.key] = s.value;
      });

      return {
        success: true,
        data: {
          platformName: map.platformName || defaults.platformName,
          supportEmail: map.supportEmail || defaults.supportEmail,
          currency: map.currency || defaults.currency,
          defaultTrialDays: Number(map.defaultTrialDays) || defaults.defaultTrialDays,
          allowPublicSignup: map.allowPublicSignup !== undefined ? map.allowPublicSignup === "true" : defaults.allowPublicSignup,
          paymentProvider: (map.paymentProvider as any) || defaults.paymentProvider,
          stripePublishableKey: map.stripePublishableKey || defaults.stripePublishableKey,
          stripeWebhookSecretConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
        },
      };
    } catch {
      return { success: true, data: defaults };
    }
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to load platform settings" };
  }
}

/**
 * Update platform system settings
 */
export async function updatePlatformSettingsAction(
  updates: Partial<SuperAdminPlatformSettings>
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperAdmin();
    await ensureDatabaseSchema();

    if (isMockMode()) {
      return { success: true };
    }

    const entries = Object.entries(updates);
    for (const [key, val] of entries) {
      if (val !== undefined) {
        await prisma.platformSetting.upsert({
          where: { key },
          create: { key, value: String(val) },
          update: { value: String(val) },
        });
      }
    }

    revalidatePath("/super-admin/settings");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to update platform settings" };
  }
}

