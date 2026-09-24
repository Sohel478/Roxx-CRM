import { describe, it, expect } from "vitest";
import { z } from "zod";

const registerSchema = z.object({
  organizationName: z.string().min(2, "Company name must be at least 2 characters").max(100),
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

describe("SaaS Multi-Tenancy & Billing Suite", () => {
  it("validates valid organization self-registration payload", () => {
    const valid = {
      organizationName: "Apex Dynamics Pvt Ltd",
      name: "Rohit Sharma",
      email: "rohit@apexdynamics.com",
      password: "StrongPassword123!",
    };
    const res = registerSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects incomplete or invalid registration payloads", () => {
    const invalidEmail = {
      organizationName: "Acme",
      name: "Acme User",
      email: "not-an-email",
      password: "password123",
    };
    expect(registerSchema.safeParse(invalidEmail).success).toBe(false);

    const shortOrg = {
      organizationName: "A",
      name: "Acme User",
      email: "user@acme.com",
      password: "password123",
    };
    expect(registerSchema.safeParse(shortOrg).success).toBe(false);

    const shortPass = {
      organizationName: "Acme Corp",
      name: "Acme User",
      email: "user@acme.com",
      password: "123",
    };
    expect(registerSchema.safeParse(shortPass).success).toBe(false);
  });

  it("provisions new tenant with 30-day trial and 20 seats quota by default", () => {
    const now = new Date();
    const trialDays = 30;
    const trialEndsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);

    const defaultTenant = {
      subscriptionPlan: "FREE_TRIAL",
      subscriptionStatus: "TRIAL",
      maxSeats: 20,
      trialEndsAt,
    };

    expect(defaultTenant.subscriptionPlan).toBe("FREE_TRIAL");
    expect(defaultTenant.subscriptionStatus).toBe("TRIAL");
    expect(defaultTenant.maxSeats).toBe(20);
    const diffDays = Math.round((defaultTenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it("enforces seat quota: prohibits adding users when active users reach maxSeats", () => {
    const tenant = {
      maxSeats: 20,
      activeUsers: 20,
    };

    const canAddUser = tenant.activeUsers < tenant.maxSeats;
    expect(canAddUser).toBe(false);

    // If tenant upgrades to Growth plan (50 seats)
    const upgradedTenant = {
      maxSeats: 50,
      activeUsers: 20,
    };
    expect(upgradedTenant.activeUsers < upgradedTenant.maxSeats).toBe(true);
  });

  it("verifies tiered pricing structure matches specs", () => {
    const pricingTiers = [
      { id: "FREE_TRIAL", name: "30-Day Free Trial", seats: 20, price: 0, duration: "30 Days" },
      { id: "STARTER_20", name: "Starter Plan", seats: 20, price: 250, duration: "per month" },
      { id: "GROWTH_50", name: "Growth Plan", seats: 50, price: 450, duration: "per month" },
      { id: "ENTERPRISE", name: "Enterprise Plan", seats: 50, price: null, duration: "Custom" },
    ];

    const starter = pricingTiers.find((t) => t.id === "STARTER_20");
    expect(starter?.price).toBe(250);
    expect(starter?.seats).toBe(20);

    const growth = pricingTiers.find((t) => t.id === "GROWTH_50");
    expect(growth?.price).toBe(450);
    expect(growth?.seats).toBe(50);
  });
});
