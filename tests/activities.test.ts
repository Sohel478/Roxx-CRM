import { describe, it, expect } from "vitest";
import {
  activitySchema,
  ACTIVITY_TYPES,
} from "@/lib/validations/activities";

describe("Activities & Touchpoints Validation Rules", () => {
  it("validates a complete and valid activity log payload", () => {
    const valid = {
      type: "CALL" as const,
      subject: "Discovery call on enterprise database tier",
      description: "Client confirmed 50 developer seats and requested follow-up next week",
      durationMinutes: 25,
      outcome: "Demo Scheduled",
      companyId: "comp_1",
      contactId: "cont_1",
    };

    const res = activitySchema.safeParse(valid);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.type).toBe("CALL");
      expect(res.data.subject).toBe("Discovery call on enterprise database tier");
      expect(res.data.durationMinutes).toBe(25);
      expect(res.data.outcome).toBe("Demo Scheduled");
    }
  });

  it("supports all standardized activity types", () => {
    expect(ACTIVITY_TYPES).toEqual([
      "CALL",
      "EMAIL",
      "MEETING",
      "WHATSAPP",
      "NOTE",
      "OTHER",
    ]);

    ACTIVITY_TYPES.forEach((type) => {
      const res = activitySchema.safeParse({
        type,
        subject: `Logged interaction of type ${type}`,
      });
      expect(res.success).toBe(true);
    });
  });

  it("rejects invalid activity type", () => {
    const invalid = {
      type: "TELEPATHY",
      subject: "Telepathic thought transmission",
    };

    const res = activitySchema.safeParse(invalid);
    expect(res.success).toBe(false);
  });

  it("rejects activity without subject", () => {
    const invalid = {
      type: "CALL",
      subject: "",
    };

    const res = activitySchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("at least 2 characters");
    }
  });

  it("rejects negative duration minutes", () => {
    const invalid = {
      type: "CALL",
      subject: "Negative duration call",
      durationMinutes: -15,
    };

    const res = activitySchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Duration cannot be negative");
    }
  });

  it("rejects durations exceeding 24 hours (1440 minutes)", () => {
    const invalid = {
      type: "MEETING",
      subject: "Overlong marathon session",
      durationMinutes: 2000,
    };

    const res = activitySchema.safeParse(invalid);
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.errors[0]?.message).toContain("Duration cannot exceed 24 hours");
    }
  });
});
