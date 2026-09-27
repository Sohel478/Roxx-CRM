import { prisma } from "@/lib/db/prisma";
import {
  mockSubscriptionsStore,
  mockPlansStore,
  mockUsersStore,
  mockLeadsStore,
  mockCompaniesStore,
  mockContactsStore,
  mockOpportunitiesStore,
} from "@/lib/db/mock-store";
import { ensureDatabaseSchema } from "@/lib/db/migrate";

export type SubscriptionResource =
  | "users"
  | "leads"
  | "companies"
  | "contacts"
  | "opportunities"
  | "pipelines";

export interface PlanFeatureMap {
  users_limit: number;
  leads_limit: number;
  companies_limit: number;
  contacts_limit: number;
  opportunities_limit: number;
  pipelines_limit: number;
  advanced_reports: boolean;
  export: boolean;
  api_access: boolean;
  ai_features: boolean;
  [key: string]: number | boolean;
}

export type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "EXPIRED"
  | "SUSPENDED"
  | "PAST_DUE"
  | "CANCELLED";

export interface CurrentSubscriptionData {
  id: string;
  organizationId: string;
  planId: string;
  planName: string;
  planSlug: string;
  status: SubscriptionStatus;
  price: number;
  currency: string;
  billingInterval: string;
  startDate: string;
  endDate: string | null;
  trialStartDate: string | null;
  trialEndDate: string | null;
  renewalDate: string | null;
  features: PlanFeatureMap;
}

export interface ResourceLimitCheck {
  allowed: boolean;
  current: number;
  limit: number;
  message?: string;
}

export interface TenantUsageSummary {
  subscription: CurrentSubscriptionData;
  usage: {
    users: { current: number; limit: number; percentage: number };
    leads: { current: number; limit: number; percentage: number };
    companies: { current: number; limit: number; percentage: number };
    contacts: { current: number; limit: number; percentage: number };
    opportunities: { current: number; limit: number; percentage: number };
  };
  isSuspended: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
}

const DEFAULT_STARTER_LIMITS: PlanFeatureMap = {
  users_limit: 3,
  leads_limit: 1000,
  companies_limit: 500,
  contacts_limit: 1000,
  opportunities_limit: 500,
  pipelines_limit: 1,
  advanced_reports: false,
  export: true,
  api_access: false,
  ai_features: false,
};

export class SubscriptionService {
  /**
   * Determine if we are running with a mock in-memory database or real Neon PostgreSQL
   */
  private static isMockMode(): boolean {
    return (
      !process.env.DATABASE_URL ||
      process.env.DATABASE_URL.includes("ep-sample-pooler") ||
      process.env.DATABASE_URL.includes("user:password")
    );
  }

  /**
   * Retrieves the current subscription, plan, and feature limits for an organization
   */
  static async getCurrentSubscription(
    organizationId: string
  ): Promise<CurrentSubscriptionData> {
    if (!organizationId) {
      throw new Error("organizationId is required to fetch subscription");
    }

    if (this.isMockMode()) {
      const sub =
        mockSubscriptionsStore.find((s) => s.organizationId === organizationId) ||
        mockSubscriptionsStore[0];
      const plan =
        mockPlansStore.find((p) => p.id === sub?.planId) || mockPlansStore[1]; // default professional

      const features: PlanFeatureMap = {
        users_limit: parseInt(plan.features.users_limit || "10", 10),
        leads_limit: parseInt(plan.features.leads_limit || "10000", 10),
        companies_limit: parseInt(plan.features.companies_limit || "5000", 10),
        contacts_limit: parseInt(plan.features.contacts_limit || "10000", 10),
        opportunities_limit: parseInt(plan.features.opportunities_limit || "5000", 10),
        pipelines_limit: parseInt(plan.features.pipelines_limit || "5", 10),
        advanced_reports: plan.features.advanced_reports === "true",
        export: plan.features.export === "true",
        api_access: plan.features.api_access === "true",
        ai_features: plan.features.ai_features === "true",
      };

      return {
        id: sub?.id || "sub_mock",
        organizationId,
        planId: plan.id,
        planName: plan.name,
        planSlug: plan.slug,
        status: sub?.status || "TRIAL",
        price: plan.price,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        startDate: sub?.startDate || new Date().toISOString(),
        endDate: sub?.endDate || null,
        trialStartDate: sub?.trialStartDate || null,
        trialEndDate: sub?.trialEndDate || null,
        renewalDate: sub?.renewalDate || null,
        features,
      };
    }

    await ensureDatabaseSchema();

    try {
      const sub = await prisma.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        include: {
          plan: {
            include: {
              features: true,
            },
          },
        },
      });

      if (sub && sub.plan) {
        const featureMap: PlanFeatureMap = { ...DEFAULT_STARTER_LIMITS };
        for (const feat of sub.plan.features) {
          if (feat.featureValue === "true") {
            featureMap[feat.featureKey] = true;
          } else if (feat.featureValue === "false") {
            featureMap[feat.featureKey] = false;
          } else {
            const num = parseInt(feat.featureValue, 10);
            featureMap[feat.featureKey] = isNaN(num) ? feat.featureValue === "true" : num;
          }
        }

        return {
          id: sub.id,
          organizationId: sub.organizationId,
          planId: sub.plan.id,
          planName: sub.plan.name,
          planSlug: sub.plan.slug,
          status: sub.status as SubscriptionStatus,
          price: Number(sub.plan.price),
          currency: sub.plan.currency,
          billingInterval: sub.billingInterval,
          startDate: sub.startDate.toISOString(),
          endDate: sub.endDate?.toISOString() || null,
          trialStartDate: sub.trialStartDate?.toISOString() || null,
          trialEndDate: sub.trialEndDate?.toISOString() || null,
          renewalDate: sub.renewalDate?.toISOString() || null,
          features: featureMap,
        };
      }
    } catch (err) {
      console.warn("[SubscriptionService.getCurrentSubscription] DB query fallback:", err);
    }

    // Fallback: load organization directly from organization record
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        subscriptionPlan: true,
        subscriptionStatus: true,
        maxSeats: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
        createdAt: true,
      },
    });

    const isTrial = org?.subscriptionStatus === "TRIAL";
    const status = (org?.subscriptionStatus as SubscriptionStatus) || "TRIAL";

    return {
      id: `sub_${organizationId}`,
      organizationId,
      planId: "plan_starter",
      planName: org?.subscriptionPlan ? String(org.subscriptionPlan).replace("_", " ") : "Starter",
      planSlug: "starter",
      status,
      price: 29,
      currency: "USD",
      billingInterval: "MONTHLY",
      startDate: org?.createdAt?.toISOString() || new Date().toISOString(),
      endDate: org?.subscriptionEndsAt?.toISOString() || null,
      trialStartDate: isTrial ? org?.createdAt?.toISOString() || null : null,
      trialEndDate: isTrial ? org?.trialEndsAt?.toISOString() || null : null,
      renewalDate: org?.subscriptionEndsAt?.toISOString() || org?.trialEndsAt?.toISOString() || null,
      features: {
        ...DEFAULT_STARTER_LIMITS,
        users_limit: org?.maxSeats || 3,
      },
    };
  }

  /**
   * Returns true if organization has an ACTIVE or unexpired TRIAL subscription
   */
  static async isActive(organizationId: string): Promise<boolean> {
    const sub = await this.getCurrentSubscription(organizationId);
    if (sub.status === "SUSPENDED" || sub.status === "EXPIRED" || sub.status === "CANCELLED") {
      return false;
    }

    if (sub.status === "TRIAL" && sub.trialEndDate) {
      return new Date(sub.trialEndDate).getTime() > Date.now();
    }

    if (sub.status === "ACTIVE" && sub.endDate) {
      return new Date(sub.endDate).getTime() > Date.now();
    }

    return true;
  }

  /**
   * Returns true if organization is currently in Free Trial mode
   */
  static async isTrial(organizationId: string): Promise<boolean> {
    const sub = await this.getCurrentSubscription(organizationId);
    return sub.status === "TRIAL";
  }

  /**
   * Returns true if organization's trial or subscription has expired
   */
  static async isExpired(organizationId: string): Promise<boolean> {
    const active = await this.isActive(organizationId);
    return !active;
  }

  /**
   * Checks whether the organization's plan entitles them to a boolean feature flag
   */
  static async hasFeature(organizationId: string, featureKey: string): Promise<boolean> {
    const sub = await this.getCurrentSubscription(organizationId);
    return Boolean(sub.features[featureKey]);
  }

  /**
   * Retrieves the configured limit for a given resource
   */
  static async getLimit(organizationId: string, resource: SubscriptionResource): Promise<number> {
    const sub = await this.getCurrentSubscription(organizationId);
    const key = `${resource}_limit`;
    const val = sub.features[key];
    return typeof val === "number" ? val : 999999;
  }

  /**
   * Server-side check before creating new entities.
   * Returns allowed: true or allowed: false with a descriptive upgrade prompt.
   */
  static async checkLimit(
    organizationId: string,
    resource: SubscriptionResource
  ): Promise<ResourceLimitCheck> {
    // 1. Check if organization or subscription is expired/suspended
    const active = await this.isActive(organizationId);
    if (!active) {
      return {
        allowed: false,
        current: 0,
        limit: 0,
        message: "Your subscription or free trial has expired. Please renew or upgrade your plan to perform write operations.",
      };
    }

    const limit = await this.getLimit(organizationId, resource);
    let current = 0;

    if (this.isMockMode()) {
      switch (resource) {
        case "users":
          current = mockUsersStore.filter((u) => u.organizationId === organizationId).length;
          break;
        case "leads":
          current = mockLeadsStore.filter((l) => l.organizationId === organizationId).length;
          break;
        case "companies":
          current = mockCompaniesStore.filter((c) => c.organizationId === organizationId).length;
          break;
        case "contacts":
          current = mockContactsStore.filter((c) => c.organizationId === organizationId).length;
          break;
        case "opportunities":
          current = mockOpportunitiesStore.filter((o) => o.organizationId === organizationId).length;
          break;
        case "pipelines":
          current = 1;
          break;
      }
    } else {
      try {
        switch (resource) {
          case "users":
            current = await prisma.user.count({ where: { organizationId } });
            break;
          case "leads":
            current = await prisma.lead.count({ where: { organizationId, deletedAt: null } });
            break;
          case "companies":
            current = await prisma.company.count({ where: { organizationId, deletedAt: null } });
            break;
          case "contacts":
            current = await prisma.contact.count({ where: { organizationId, deletedAt: null } });
            break;
          case "opportunities":
            current = await prisma.opportunity.count({ where: { organizationId, deletedAt: null } });
            break;
          case "pipelines":
            current = await prisma.pipeline.count({ where: { organizationId } });
            break;
        }
      } catch (err) {
        console.warn("[SubscriptionService.checkLimit] Count error, allowing operation:", err);
        return { allowed: true, current: 0, limit };
      }
    }

    if (current >= limit) {
      const resourceLabels: Record<SubscriptionResource, string> = {
        users: "Team Members",
        leads: "Leads",
        companies: "Companies",
        contacts: "Contacts",
        opportunities: "Deals / Opportunities",
        pipelines: "Sales Pipelines",
      };

      return {
        allowed: false,
        current,
        limit,
        message: `Plan limit reached: You have reached the maximum allowed limit of ${limit.toLocaleString()} ${resourceLabels[resource]} on your current plan. Please upgrade to a higher tier to add more.`,
      };
    }

    return {
      allowed: true,
      current,
      limit,
    };
  }

  /**
   * Retrieves complete usage summary vs limits for display in Organization Settings or Super Admin
   */
  static async getUsage(organizationId: string): Promise<TenantUsageSummary> {
    const sub = await this.getCurrentSubscription(organizationId);
    let usersCount = 0;
    let leadsCount = 0;
    let companiesCount = 0;
    let contactsCount = 0;
    let opportunitiesCount = 0;

    if (this.isMockMode()) {
      usersCount = mockUsersStore.filter((u) => u.organizationId === organizationId).length;
      leadsCount = mockLeadsStore.filter((l) => l.organizationId === organizationId).length;
      companiesCount = mockCompaniesStore.filter((c) => c.organizationId === organizationId).length;
      contactsCount = mockContactsStore.filter((c) => c.organizationId === organizationId).length;
      opportunitiesCount = mockOpportunitiesStore.filter((o) => o.organizationId === organizationId).length;
    } else {
      try {
        [usersCount, leadsCount, companiesCount, contactsCount, opportunitiesCount] =
          await Promise.all([
            prisma.user.count({ where: { organizationId } }),
            prisma.lead.count({ where: { organizationId, deletedAt: null } }),
            prisma.company.count({ where: { organizationId, deletedAt: null } }),
            prisma.contact.count({ where: { organizationId, deletedAt: null } }),
            prisma.opportunity.count({ where: { organizationId, deletedAt: null } }),
          ]);
      } catch {
        usersCount = 1;
      }
    }

    const usersLimit = Number(sub.features.users_limit) || 3;
    const leadsLimit = Number(sub.features.leads_limit) || 1000;
    const companiesLimit = Number(sub.features.companies_limit) || 500;
    const contactsLimit = Number(sub.features.contacts_limit) || 1000;
    const oppsLimit = Number(sub.features.opportunities_limit) || 500;

    let daysRemaining: number | null = null;
    const targetDate = sub.status === "TRIAL" ? sub.trialEndDate : sub.endDate || sub.renewalDate;
    if (targetDate) {
      const diffMs = new Date(targetDate).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    return {
      subscription: sub,
      usage: {
        users: {
          current: usersCount,
          limit: usersLimit,
          percentage: Math.min(100, Math.round((usersCount / usersLimit) * 100)),
        },
        leads: {
          current: leadsCount,
          limit: leadsLimit,
          percentage: Math.min(100, Math.round((leadsCount / leadsLimit) * 100)),
        },
        companies: {
          current: companiesCount,
          limit: companiesLimit,
          percentage: Math.min(100, Math.round((companiesCount / companiesLimit) * 100)),
        },
        contacts: {
          current: contactsCount,
          limit: contactsLimit,
          percentage: Math.min(100, Math.round((contactsCount / contactsLimit) * 100)),
        },
        opportunities: {
          current: opportunitiesCount,
          limit: oppsLimit,
          percentage: Math.min(100, Math.round((opportunitiesCount / oppsLimit) * 100)),
        },
      },
      isSuspended: sub.status === "SUSPENDED",
      isExpired: sub.status === "EXPIRED" || (daysRemaining !== null && daysRemaining <= 0),
      daysRemaining,
    };
  }
}
