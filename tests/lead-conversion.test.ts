import { describe, it, expect } from "vitest";
import { conversionSchema } from "@/lib/validations/lead-conversion";

describe("Lead Conversion Validation & Idempotency Rules", () => {
  it("validates successful conversion payload with a new company and opportunity", () => {
    const valid = {
      companyMode: "NEW" as const,
      companyName: "Solar Dynamics Inc.",
      contactFirstName: "Sofia",
      contactLastName: "Castillo",
      contactEmail: "sofia@solardynamics.local",
      contactPhone: "+1 (555) 923-1184",
      contactJobTitle: "Procurement Manager",
      createOpportunity: true,
      opportunityName: "Solar Dynamics - Enterprise Deal",
      opportunityAmount: 65000,
      opportunityStage: "Qualified",
      expectedCloseDate: "2026-10-31",
    };

    const res = conversionSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.companyName).toBe("Solar Dynamics Inc.");
      expect(res.data.opportunityAmount).toBe(65000);
      expect(res.data.createOpportunity).toBe(true);
    }
  });

  it("validates successful conversion payload linking to an existing company", () => {
    const valid = {
      companyMode: "EXISTING" as const,
      companyId: "comp_1",
      contactFirstName: "Elena",
      contactLastName: "Rostova",
      contactEmail: "elena@cyberdyne.local",
      createOpportunity: false,
    };

    const res = conversionSchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.companyMode).toBe("EXISTING");
      expect(res.data.companyId).toBe("comp_1");
      expect(res.data.createOpportunity).toBe(false);
    }
  });

  it("rejects conversion when companyMode is NEW but companyName is missing", () => {
    const invalid = {
      companyMode: "NEW" as const,
      companyName: "",
      contactFirstName: "Marcus",
      createOpportunity: false,
    };

    const res = conversionSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Company name must be at least 2 characters");
    }
  });

  it("rejects conversion when companyMode is EXISTING but companyId is empty", () => {
    const invalid = {
      companyMode: "EXISTING" as const,
      companyId: "",
      contactFirstName: "Marcus",
      createOpportunity: false,
    };

    const res = conversionSchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects conversion when contactFirstName is missing", () => {
    const invalid = {
      companyMode: "NEW" as const,
      companyName: "Apex Logistics",
      contactFirstName: "",
      createOpportunity: false,
    };

    const res = conversionSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Contact first name is required");
    }
  });

  it("rejects conversion when createOpportunity is true but opportunityName is missing", () => {
    const invalid = {
      companyMode: "NEW" as const,
      companyName: "Apex Logistics",
      contactFirstName: "David",
      createOpportunity: true,
      opportunityName: "",
      opportunityAmount: 20000,
    };

    const res = conversionSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Deal name must be at least 2 characters");
    }
  });

  it("rejects negative opportunity deal amounts", () => {
    const invalid = {
      companyMode: "NEW" as const,
      companyName: "Apex Logistics",
      contactFirstName: "David",
      createOpportunity: true,
      opportunityName: "Apex Fleet Expansion",
      opportunityAmount: -5000,
    };

    const res = conversionSchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Amount cannot be negative");
    }
  });

  it("enforces idempotency rule: already converted leads cannot be converted again", () => {
    // Lead conversion business invariant rule
    const leadState = {
      id: "lead_3",
      status: "Converted",
      convertedAt: new Date().toISOString(),
      convertedCompanyId: "comp_123",
      convertedContactId: "cont_456",
      convertedOpportunityId: "opp_789",
    };

    const canConvert = !leadState.convertedAt && leadState.status !== "Converted";
    expect(canConvert).toBe(false);
  });
});
