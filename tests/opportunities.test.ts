import { describe, it, expect } from "vitest";
import {
  opportunitySchema,
  closeOpportunitySchema,
  PIPELINE_STAGES,
  LOSS_REASONS,
} from "@/lib/validations/opportunities";

describe("Opportunities & Pipeline Validation Rules", () => {
  it("validates valid opportunity creation payload", () => {
    const valid = {
      name: "Acme - Enterprise Cloud Migration",
      amount: 85000,
      currency: "USD",
      companyId: "comp_1",
      primaryContactId: "cont_1",
      stageName: "Proposal",
      expectedCloseDate: "2026-11-15",
      description: "Migration of 50+ seats to cloud infrastructure",
    };

    const res = opportunitySchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.name).toBe("Acme - Enterprise Cloud Migration");
      expect(res.data.amount).toBe(85000);
      expect(res.data.stageName).toBe("Proposal");
    }
  });

  it("rejects opportunity with negative deal amount", () => {
    const invalid = {
      name: "Invalid Deal",
      amount: -1000,
      companyId: "comp_1",
    };

    const res = opportunitySchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Amount cannot be negative");
    }
  });

  it("rejects opportunity without a company", () => {
    const invalid = {
      name: "Standalone Deal",
      amount: 5000,
      companyId: "",
    };

    const res = opportunitySchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Company is required");
    }
  });

  it("validates closing a deal as WON without requiring loss reason", () => {
    const validWon = {
      status: "WON" as const,
    };

    const res = closeOpportunitySchema.safeParse(validWon);
    expect(res.success).toBe(true);
  });

  it("requires a structured loss reason when closing a deal as LOST", () => {
    const invalidLost = {
      status: "LOST" as const,
      lossReason: "",
    };

    const res = closeOpportunitySchema.safeParse(invalidLost);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain(
        "A structured loss reason is required when marking a deal as Lost"
      );
    }
  });

  it("accepts a valid loss reason from the standardized list", () => {
    const validLost = {
      status: "LOST" as const,
      lossReason: LOSS_REASONS[0],
      lossNotes: "Client opted to renew on-prem hardware for one more year.",
    };

    const res = closeOpportunitySchema.safeParse(validLost);
    expect(res.success).toBe(true);
  });

  it("maintains the 7 standardized sales pipeline stages with accurate probabilities", () => {
    expect(PIPELINE_STAGES.length).toBe(7);

    const stageNames = PIPELINE_STAGES.map((s) => s.name);
    expect(stageNames).toEqual([
      "New",
      "Qualified",
      "Discovery",
      "Proposal",
      "Negotiation",
      "Won",
      "Lost",
    ]);

    const wonStage = PIPELINE_STAGES.find((s) => s.name === "Won");
    expect(wonStage?.probability).toBe(100);
    expect(wonStage?.isWon).toBe(true);

    const lostStage = PIPELINE_STAGES.find((s) => s.name === "Lost");
    expect(lostStage?.probability).toBe(0);
    expect(lostStage?.isLost).toBe(true);

    const proposalStage = PIPELINE_STAGES.find((s) => s.name === "Proposal");
    expect(proposalStage?.probability).toBe(60);
  });
});
