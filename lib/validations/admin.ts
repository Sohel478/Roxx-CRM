export interface TenantItem {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PAST_DUE" | "CANCELLED";
  maxSeats: number;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  billingEmail: string | null;
  billingPhone: string | null;
  subscriptionNotes: string | null;
  isDemo?: boolean;
  website?: string | null;
  createdAt: string;
  usersCount: number;
  leadsCount: number;
  dealsCount: number;
}

export interface UpdateTenantSubscriptionInput {
  organizationId: string;
  subscriptionPlan?: string;
  subscriptionStatus?: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED" | "PAST_DUE" | "CANCELLED";
  maxSeats?: number;
  extendMonths?: number;
  subscriptionNotes?: string;
  customExpiryDate?: string;
}

export interface SuperAdminDashboardMetrics {
  totalOrganizations: number;
  activeOrganizations: number;
  trialOrganizations: number;
  expiredOrganizations: number;
  suspendedOrganizations: number;
  totalUsers: number;
  totalLeads: number;
  totalOpportunities: number;
  mrr: number;
  planDistribution: { plan: string; count: number }[];
  recentTenants: TenantItem[];
}

export interface SuperAdminPlanItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  billingInterval: string;
  isActive: boolean;
  isPublic: boolean;
  features: {
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
  };
  activeSubscriptionsCount: number;
}

export interface SuperAdminSubscriptionItem {
  id: string;
  organizationId: string;
  organizationName: string;
  planName: string;
  status: string;
  startDate: string;
  endDate: string | null;
  trialEndDate: string | null;
  renewalDate: string | null;
  billingInterval: string;
  createdAt: string;
  eventsCount: number;
}

export interface SuperAdminPaymentItem {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  externalPaymentId: string | null;
  createdAt: string;
}

export interface TenantDetailData {
  organization: TenantItem;
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
  }[];
  usage: {
    users: { current: number; limit: number };
    leads: { current: number; limit: number };
    companies: { current: number; limit: number };
    contacts: { current: number; limit: number };
    opportunities: { current: number; limit: number };
  };
  events: {
    id: string;
    eventType: string;
    notes: string | null;
    createdAt: string;
  }[];
  auditLogs: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: string;
  }[];
}

export interface SuperAdminAuditLogItem {
  id: string;
  organizationId: string | null;
  organizationName: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
}

export interface SuperAdminUsageItem {
  organizationId: string;
  organizationName: string;
  planName: string;
  status: string;
  usersCount: number;
  usersLimit: number;
  leadsCount: number;
  leadsLimit: number;
  opportunitiesCount: number;
  opportunitiesLimit: number;
  companiesCount: number;
  contactsCount: number;
  storageEstimateMb: number;
}

export interface SuperAdminPlatformSettings {
  platformName: string;
  supportEmail: string;
  currency: string;
  defaultTrialDays: number;
  allowPublicSignup: boolean;
  paymentProvider: "mock" | "stripe";
  stripePublishableKey: string;
  stripeWebhookSecretConfigured: boolean;
}

