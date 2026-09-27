import { describe, it, expect } from "vitest";
import { SubscriptionService } from "@/lib/subscription/subscription-service";
import { getPaymentProvider, MockPaymentProvider } from "@/lib/billing/payment-provider";
import { mockOrganizationsStore, mockPlansStore, mockUsersStore } from "@/lib/db/mock-store";
import { createSessionToken, verifySessionToken } from "@/lib/auth/session";

describe("SaaS Subscription Engine & Super Admin Tests", () => {
  describe("SubscriptionService Limits & Entitlements", () => {
    it("retrieves current subscription for demo organization", async () => {
      const sub = await SubscriptionService.getCurrentSubscription("demo-org-123");
      expect(sub).toBeDefined();
      expect(sub.status).toBe("TRIAL");
      expect(sub.planName).toBe("Professional");
      expect(sub.features.users_limit).toBeGreaterThan(0);
      expect(sub.features.leads_limit).toBeGreaterThan(0);
    });

    it("evaluates active / trial status correctly", async () => {
      const isTrial = await SubscriptionService.isTrial("demo-org-123");
      expect(isTrial).toBe(true);

      const isExpired = await SubscriptionService.isExpired("demo-org-123");
      expect(isExpired).toBe(false);
    });

    it("verifies feature entitlement checks", async () => {
      const hasExport = await SubscriptionService.hasFeature("demo-org-123", "export");
      expect(hasExport).toBe(true);

      const hasReports = await SubscriptionService.hasFeature("demo-org-123", "advanced_reports");
      expect(hasReports).toBe(true);

      // AI is exclusive to Business and Enterprise tiers (false for Professional)
      const hasAi = await SubscriptionService.hasFeature("demo-org-123", "ai_features");
      expect(hasAi).toBe(false);
    });

    it("checks resource limit correctly within capacity", async () => {
      const check = await SubscriptionService.checkLimit("demo-org-123", "leads");
      expect(check.allowed).toBe(true);
      expect(check.limit).toBeGreaterThan(0);
    });

    it("calculates tenant usage statistics", async () => {
      const usage = await SubscriptionService.getUsage("demo-org-123");
      expect(usage.subscription.organizationId).toBe("demo-org-123");
      expect(usage.subscription.planName).toBe("Professional");
      expect(usage.usage.users).toBeDefined();
      expect(usage.usage.leads).toBeDefined();
      expect(usage.usage.opportunities).toBeDefined();
    });
  });

  describe("Payment Provider Architecture", () => {
    it("creates a mock checkout session with valid URL and session_id", async () => {
      const provider = new MockPaymentProvider();
      const session = await provider.createCheckoutSession({
        organizationId: "org_test_123",
        organizationName: "Acme Corp",
        customerEmail: "admin@acme.com",
        planId: "plan_professional",
        planName: "Professional",
        amount: 79,
        currency: "USD",
        billingInterval: "MONTHLY",
        successUrl: "http://localhost:3000/dashboard",
        cancelUrl: "http://localhost:3000/pricing",
      });

      expect(session.sessionId).toContain("mock_cs_");
      expect(session.checkoutUrl).toContain("session_id=");
      expect(session.checkoutUrl).toContain("mock_paid=true");
    });

    it("verifies and extracts webhook event payloads", async () => {
      const provider = new MockPaymentProvider();
      const rawPayload = JSON.stringify({
        id: "evt_12345",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            client_reference_id: "org_test_123",
            amount_total: 7900,
            currency: "usd",
          },
        },
      });

      const event = await provider.verifyWebhook(rawPayload, "mock_signature");
      expect(event).toBeDefined();
      expect(event?.type).toBe("checkout.session.completed");
      expect(event?.data.object.client_reference_id).toBe("org_test_123");
    });

    it("factory getPaymentProvider returns a valid provider instance", () => {
      const provider = getPaymentProvider("mock");
      expect(provider.name).toBe("MOCK");
    });
  });

  describe("Tenant Isolation & Demo Protections", () => {
    it("confirms demo organization is flagged with isDemo = true", () => {
      const demoOrg = mockOrganizationsStore.find((o) => o.slug === "demo-company" || o.isDemo);
      expect(demoOrg).toBeDefined();
      expect(demoOrg?.isDemo).toBe(true);
    });

    it("validates that all 4 master plans are configured in mock/seed data", () => {
      const planSlugs = mockPlansStore.map((p) => p.slug);
      expect(planSlugs).toContain("starter");
      expect(planSlugs).toContain("professional");
      expect(planSlugs).toContain("business");
      expect(planSlugs).toContain("enterprise");
    });
  });

  describe("Org Admin vs Platform Super Admin Role Isolation", () => {
    it("ensures Org Admin admin@roxx-crm.local is NOT marked as super admin", () => {
      const orgAdmin = mockUsersStore.find((u) => u.email === "admin@roxx-crm.local");
      expect(orgAdmin).toBeDefined();
      expect(orgAdmin?.role).toBe("ADMIN");
      expect(orgAdmin?.isSuperAdmin).toBe(false);
    });

    it("ensures dedicated platform super admin superadmin@roxx-crm.local IS marked as super admin", () => {
      const platformAdmin = mockUsersStore.find((u) => u.email === "superadmin@roxx-crm.local");
      expect(platformAdmin).toBeDefined();
      expect(platformAdmin?.isSuperAdmin).toBe(true);
    });

    it("creates Org Admin session without super admin privileges", async () => {
      const orgAdmin = mockUsersStore.find((u) => u.email === "admin@roxx-crm.local")!;
      const token = await createSessionToken({
        id: orgAdmin.id,
        organizationId: orgAdmin.organizationId,
        organizationName: "Demo Company",
        email: orgAdmin.email,
        name: orgAdmin.name,
        role: orgAdmin.role,
        permissions: ["lead:read", "lead:create"],
        isSuperAdmin: Boolean(orgAdmin.isSuperAdmin),
      });

      const session = await verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.email).toBe("admin@roxx-crm.local");
      expect(session?.isSuperAdmin).toBe(false);
    });

    it("creates Platform Super Admin session with super admin privileges", async () => {
      const superAdmin = mockUsersStore.find((u) => u.email === "superadmin@roxx-crm.local")!;
      const token = await createSessionToken({
        id: superAdmin.id,
        organizationId: superAdmin.organizationId,
        organizationName: "Roxx Platform",
        email: superAdmin.email,
        name: superAdmin.name,
        role: "SUPER_ADMIN",
        permissions: ["*"],
        isSuperAdmin: Boolean(superAdmin.isSuperAdmin),
      });

      const session = await verifySessionToken(token);
      expect(session).not.toBeNull();
      expect(session?.email).toBe("superadmin@roxx-crm.local");
      expect(session?.isSuperAdmin).toBe(true);
    });
  });

  describe("Subscription Plan Model CRUD Operations", () => {
    const testPlanSlug = `test-agency-${Date.now()}`;

    it("supports creating a new plan in the plans store", () => {
      const newPlan = {
        id: `plan_${Date.now()}`,
        name: "Agency Accelerator",
        slug: testPlanSlug,
        description: "High capacity agency tier with white labeling and AI.",
        price: 149,
        currency: "USD",
        billingInterval: "MONTHLY",
        isActive: true,
        isPublic: true,
        features: {
          users_limit: "15",
          leads_limit: "25000",
          companies_limit: "10000",
          contacts_limit: "25000",
          opportunities_limit: "10000",
          pipelines_limit: "10",
          advanced_reports: "true",
          export: "true",
          api_access: "true",
          ai_features: "true",
        },
        createdAt: new Date().toISOString(),
      };

      mockPlansStore.push(newPlan);

      const found = mockPlansStore.find((p) => p.slug === testPlanSlug);
      expect(found).toBeDefined();
      expect(found?.name).toBe("Agency Accelerator");
      expect(found?.price).toBe(149);
      expect(found?.features.ai_features).toBe("true");
      expect(found?.features.users_limit).toBe("15");
    });

    it("supports updating plan pricing, limits, and feature flags", () => {
      const plan = mockPlansStore.find((p) => p.slug === testPlanSlug);
      expect(plan).toBeDefined();

      if (plan) {
        plan.price = 179;
        plan.features.users_limit = "20";
        plan.features.api_access = "false";
      }

      const updated = mockPlansStore.find((p) => p.slug === testPlanSlug);
      expect(updated?.price).toBe(179);
      expect(updated?.features.users_limit).toBe("20");
      expect(updated?.features.api_access).toBe("false");
    });

    it("supports deleting an unused plan", () => {
      const initialCount = mockPlansStore.length;
      const idx = mockPlansStore.findIndex((p) => p.slug === testPlanSlug);
      expect(idx).toBeGreaterThanOrEqual(0);

      mockPlansStore.splice(idx, 1);
      expect(mockPlansStore.length).toBe(initialCount - 1);
      expect(mockPlansStore.find((p) => p.slug === testPlanSlug)).toBeUndefined();
    });
  });
});
