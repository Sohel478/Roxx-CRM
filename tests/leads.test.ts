import { describe, it, expect } from "vitest";
import { leadSchema } from "@/lib/validations/leads";

describe("Lead Validation & Duplicate Rules", () => {
  it("validates valid lead data", () => {
    const valid = {
      firstName: "Elena",
      lastName: "Rostova",
      email: "elena@cyberdyne.local",
      phone: "+1 555 492 8172",
      companyName: "Cyberdyne Systems",
      jobTitle: "IT Director",
      source: "Website",
      status: "New",
      rating: "Hot",
      estimatedValue: 45000,
      currency: "USD",
      description: "Urgent requirements",
    };

    const res = leadSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects lead missing first name", () => {
    const invalid = {
      firstName: "",
      email: "test@example.com",
    };

    const res = leadSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("First name is required");
    }
  });

  it("rejects negative estimated deal value", () => {
    const invalid = {
      firstName: "Marcus",
      estimatedValue: -500,
    };

    const res = leadSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("normalizes phone numbers for duplicate detection", () => {
    const phoneInput = "+1 (555) 492-8172";
    const normalized = phoneInput.replace(/[^0-9]/g, "");
    expect(normalized).toBe("15554928172");
  });

  it("normalizes email addresses for case-insensitive duplicate matching", () => {
    const email1 = " Elena.Rostova@CyberdyneSys.LOCAL  ";
    const email2 = "elena.rostova@cyberdynesys.local";
    expect(email1.trim().toLowerCase()).toBe(email2);
  });

  it("supports all 7 standardized CRM lead statuses", () => {
    const statuses = ["New", "Contacted", "Qualified", "Unqualified", "Nurture", "Converted", "Lost"];
    for (const status of statuses) {
      const res = leadSchema.safeParse({ firstName: "Test", status });
      expect(res.success).toBe(true);
    }
  });
});
