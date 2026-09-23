import { describe, it, expect } from "vitest";
import { contactSchema } from "@/lib/validations/contacts";

describe("Contact Validation & Business Logic", () => {
  it("validates valid contact data", () => {
    const valid = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "+1 555 987 6543",
      jobTitle: "CTO",
      department: "Technology",
      linkedinUrl: "https://linkedin.com/in/johndoe",
      companyId: "comp_123",
    };

    const res = contactSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("rejects contact without first name", () => {
    const invalid = {
      firstName: "",
      lastName: "Doe",
    };

    const res = contactSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("First name is required");
    }
  });

  it("rejects invalid email address", () => {
    const invalid = {
      firstName: "Jane",
      email: "invalid-email-address",
    };

    const res = contactSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("allows contact without company association (standalone)", () => {
    const valid = {
      firstName: "Independent",
      lastName: "Consultant",
      email: "consultant@example.com",
    };

    const res = contactSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });
});
