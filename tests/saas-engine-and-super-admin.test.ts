import { describe, it, expect } from "vitest";
import { SubscriptionService } from "@/lib/subscription/subscription-service";
import { getPaymentProvider, MockPaymentProvider } from "@/lib/billing/payment-provider";
import { mockOrganizationsStore, mockPlansStore } from "@/lib/db/mock-store";

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
});
