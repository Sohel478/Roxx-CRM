import { describe, it, expect } from "vitest";
import {
  userCreateSchema,
  userUpdateSchema,
  organizationSettingsSchema,
  pipelineStageSchema,
  USER_ROLES,
} from "@/lib/validations/settings";

describe("Phase 10: Settings, Users & RBAC Validations", () => {
  it("validates successful user invitation data", () => {
    const validData = {
      name: "Marcus Vance",
      email: "marcus.vance@enterprise.com",
      password: "securePassword123!",
      role: "SALES_USER",
    };

    const parsed = userCreateSchema.safeParse(validData);
    expect(parsed.success).toBe(true);
  });

  it("rejects user creation with short passwords or invalid roles", () => {
    const shortPassword = {
      name: "Short Pw User",
      email: "user@test.com",
      password: "123", // Too short (min 6)
      role: "SALES_USER",
    };
    expect(userCreateSchema.safeParse(shortPassword).success).toBe(false);

    const invalidRole = {
      name: "Invalid Role User",
      email: "user@test.com",
      password: "validPassword123",
      role: "SUPER_GOD_MODE", // Not in USER_ROLES
    };
    expect(userCreateSchema.safeParse(invalidRole).success).toBe(false);
  });

  it("supports all defined enterprise RBAC roles", () => {
    expect(USER_ROLES).toContain("ADMIN");
    expect(USER_ROLES).toContain("MANAGER");
    expect(USER_ROLES).toContain("SALES_USER");
    expect(USER_ROLES).toContain("READ_ONLY");
  });

  it("validates user update payload", () => {
    const validUpdate = {
      id: "usr_12345",
      name: "Updated Name",
      role: "MANAGER",
      isActive: false,
    };
    const parsed = userUpdateSchema.safeParse(validUpdate);
    expect(parsed.success).toBe(true);
  });

  it("validates organization preferences settings", () => {
    const validSettings = {
      name: "Roxx Global Technologies Ltd.",
      timezone: "America/New_York (EST)",
      defaultCurrency: "USD",
      fiscalYearStart: "January",
      dateFormat: "YYYY-MM-DD",
    };
    const parsed = organizationSettingsSchema.safeParse(validSettings);
    expect(parsed.success).toBe(true);
  });

  it("enforces 3-character ISO currency codes in organization settings", () => {
    const invalidCurrency = {
      name: "Bad Currency Org",
      timezone: "UTC",
      defaultCurrency: "DOLLARS", // Must be 3 chars
      fiscalYearStart: "January",
      dateFormat: "YYYY-MM-DD",
    };
    expect(organizationSettingsSchema.safeParse(invalidCurrency).success).toBe(false);
  });

  it("validates pipeline stage configuration", () => {
    const validStage = {
      id: "stage_custom",
      name: "Technical Evaluation",
      order: 3,
      probability: 45,
      color: "#8b5cf6",
      isWon: false,
      isLost: false,
    };
    const parsed = pipelineStageSchema.safeParse(validStage);
    expect(parsed.success).toBe(true);

    const invalidProb = {
      ...validStage,
      probability: 120, // Max 100
    };
    expect(pipelineStageSchema.safeParse(invalidProb).success).toBe(false);
  });
});
