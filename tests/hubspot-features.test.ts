import { describe, it, expect } from "vitest";
import {
  applyMergeTags,
  SALES_EMAIL_TEMPLATES,
  MergeContext,
} from "@/lib/templates/email-templates";
import { globalSearchSchema } from "@/lib/validations/search";

describe("HubSpot-Inspired Features & Engines", () => {
  describe("Email Templates & Dynamic Merge Tag Engine", () => {
    it("interpolates all supported merge tags accurately", () => {
      const template =
        "Hi {{first_name}}, following up regarding {{deal_name}} for {{company_name}} valued at {{deal_amount}}. Best, {{rep_name}}";

      const context: MergeContext = {
        firstName: "Sarah",
        lastName: "Connor",
        companyName: "Cyberdyne Systems",
        dealName: "Enterprise AI Security",
        dealAmount: 120000,
        repName: "Alex Vance",
      };

      const result = applyMergeTags(template, context);
      expect(result).toBe(
        "Hi Sarah, following up regarding Enterprise AI Security for Cyberdyne Systems valued at $120,000. Best, Alex Vance"
      );
    });

    it("falls back to friendly defaults when merge context is incomplete", () => {
      const template =
        "Hello {{first_name}}, exciting news for {{company_name}} regarding {{deal_name}}! Best, {{rep_name}}";

      const emptyContext: MergeContext = {};
      const result = applyMergeTags(template, emptyContext);

      expect(result).toBe(
        "Hello there, exciting news for your company regarding our discussion! Best, Account Representative"
      );
    });

    it("verifies all predefined sales templates are structurally valid", () => {
      expect(SALES_EMAIL_TEMPLATES.length).toBeGreaterThanOrEqual(4);

      for (const tpl of SALES_EMAIL_TEMPLATES) {
        expect(tpl.id).toBeTruthy();
        expect(tpl.name).toBeTruthy();
        expect(tpl.category).toBeTruthy();
        expect(tpl.subject).toContain("{{");
        expect(tpl.body).toContain("{{");
      }
    });
  });

  describe("Deal Rotting & Stale Health Indicators", () => {
    const calculateDaysInactive = (createdAtStr: string, asOfDate: Date) => {
      const createdTime = new Date(createdAtStr).getTime();
      return Math.max(0, Math.floor((asOfDate.getTime() - createdTime) / (1000 * 60 * 60 * 24)));
    };

    const getHealthStatus = (daysInactive: number, isOpen: boolean) => {
      if (!isOpen) return "CLOSED";
      if (daysInactive >= 14) return "ROTTEN";
      if (daysInactive >= 7) return "STALE";
      if (daysInactive <= 3) return "ACTIVE";
      return "NORMAL";
    };

    it("flags deals inactive for 14+ days as ROTTEN", () => {
      const asOf = new Date("2026-09-24T12:00:00Z");
      const createdDate = "2026-09-08T12:00:00Z"; // 16 days ago
      const days = calculateDaysInactive(createdDate, asOf);
      expect(days).toBe(16);
      expect(getHealthStatus(days, true)).toBe("ROTTEN");
    });

    it("flags deals inactive between 7 and 13 days as STALE", () => {
      const asOf = new Date("2026-09-24T12:00:00Z");
      const createdDate = "2026-09-15T12:00:00Z"; // 9 days ago
      const days = calculateDaysInactive(createdDate, asOf);
      expect(days).toBe(9);
      expect(getHealthStatus(days, true)).toBe("STALE");
    });

    it("marks recently touched deals (<= 3 days) as ACTIVE", () => {
      const asOf = new Date("2026-09-24T12:00:00Z");
      const createdDate = "2026-09-23T12:00:00Z"; // 1 day ago
      const days = calculateDaysInactive(createdDate, asOf);
      expect(days).toBe(1);
      expect(getHealthStatus(days, true)).toBe("ACTIVE");
    });

    it("does not flag closed deals as rotting or stale", () => {
      expect(getHealthStatus(20, false)).toBe("CLOSED");
    });
  });

  describe("Global Search Validation", () => {
    it("accepts valid search queries and trims whitespace", () => {
      const res = globalSearchSchema.safeParse({ q: "  Acme Corp  " });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.q).toBe("Acme Corp");
      }
    });

    it("rejects empty or single character search queries", () => {
      const res1 = globalSearchSchema.safeParse({ q: "" });
      expect(res1.success).toBe(false);

      const res2 = globalSearchSchema.safeParse({ q: "a" });
      expect(res2.success).toBe(false);
    });
  });

  describe("Monthly Sales Quota Attainment Calculations", () => {
    it("calculates quota percentage, remaining gap, and pipeline coverage", () => {
      const quotaTarget = 100000;
      const revenueWon = 78500;
      const weightedPipeline = 45000;

      const attainmentPercent = Math.round((revenueWon / quotaTarget) * 100);
      const remainingGap = Math.max(0, quotaTarget - revenueWon);
      const pipelineCoverage =
        remainingGap > 0 ? Number(((weightedPipeline / remainingGap) * 100).toFixed(0)) : 100;

      expect(attainmentPercent).toBe(79);
      expect(remainingGap).toBe(21500);
      expect(pipelineCoverage).toBe(209); // 209% pipeline coverage over the remaining gap
    });

    it("handles overachievement (>100% quota) correctly", () => {
      const quotaTarget = 100000;
      const revenueWon = 135000;
      const weightedPipeline = 20000;

      const attainmentPercent = Math.round((revenueWon / quotaTarget) * 100);
      const remainingGap = Math.max(0, quotaTarget - revenueWon);
      const pipelineCoverage =
        remainingGap > 0 ? Number(((weightedPipeline / remainingGap) * 100).toFixed(0)) : 100;

      expect(attainmentPercent).toBe(135);
      expect(remainingGap).toBe(0);
      expect(pipelineCoverage).toBe(100);
    });
  });
});
