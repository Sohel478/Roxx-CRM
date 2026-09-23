import { describe, it, expect } from "vitest";
import { companySchema } from "@/lib/validations/companies";

describe("Company Validation & Business Logic", () => {
  it("validates valid company data", () => {
    const valid = {
      name: "Global Acme Industries",
      industry: "Manufacturing",
      website: "https://acme.example.com",
      email: "contact@acme.example.com",
      phone: "+1 555 123 4567",
      city: "Chicago",
      country: "USA",
      status: "Customer",
      description: "Premier enterprise account.",
    };

    const res = companySchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects empty company name", () => {
    const invalid = {
      name: "",
      status: "Active",
    };

    const res = companySchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Company name must be at least 2 characters");
    }
  });

  it("rejects malformed website URL", () => {
    const invalid = {
      name: "Tech Corp",
      website: "not-a-valid-url",
    };

    const res = companySchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("allows empty string for optional website and email", () => {
    const valid = {
      name: "Local Retailer",
      website: "",
      email: "",
      status: "Active",
    };

    const res = companySchema.safeParse(valid);
    expect(res.success).toBe(true);
  });
});
