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
