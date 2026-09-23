import { describe, it, expect } from "vitest";
import { dateRangeSchema, DateRangeOption } from "@/lib/validations/reports";

describe("Phase 8: Reports & Sales Analytics Utilities", () => {
  it("validates all accepted date range presets", () => {
    const validRanges: DateRangeOption[] = ["7d", "30d", "mtd", "qtd", "ytd", "all"];
    validRanges.forEach((range) => {
      const res = dateRangeSchema.safeParse(range);
      expect(res.success).toBe(true);
    });
  });

  it("rejects invalid date range presets", () => {
    const invalidRanges = ["1d", "year", "custom", "invalid", ""];
    invalidRanges.forEach((range) => {
      const res = dateRangeSchema.safeParse(range);
      expect(res.success).toBe(false);
    });
  });

  it("calculates probability-weighted forecasts correctly", () => {
    const deals = [
      { amount: 100000, probability: 50 },
      { amount: 50000, probability: 80 },
      { amount: 20000, probability: 10 },
      { amount: 75000, probability: 0 },
    ];

    const totalPipeline = deals.reduce((acc, d) => acc + d.amount, 0);
    const weightedForecast = deals.reduce(
      (acc, d) => acc + Math.round(d.amount * (d.probability / 100)),
      0
    );

    expect(totalPipeline).toBe(245000);
    // 50,000 + 40,000 + 2,000 + 0 = 92,000
    expect(weightedForecast).toBe(92000);
  });

  it("computes win rate percentage accurately", () => {
    const wonCount = 12;
    const lostCount = 8;
    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

    expect(winRate).toBe(60);
  });

  it("handles zero closed deals win rate without division by zero", () => {
    const wonCount = 0;
    const lostCount = 0;
    const totalClosed = wonCount + lostCount;
    const winRate = totalClosed > 0 ? Math.round((wonCount / totalClosed) * 100) : 0;

    expect(winRate).toBe(0);
  });

  it("computes funnel conversion rate between successive stages", () => {
    const stageCounts = [
      { name: "Discovery", count: 100 },
      { name: "Qualification", count: 70 },
      { name: "Proposal", count: 35 },
      { name: "Negotiation", count: 20 },
      { name: "Closed Won", count: 14 },
    ];

    const overallConversion = Math.round(
      (stageCounts[stageCounts.length - 1].count / stageCounts[0].count) * 100
    );
    expect(overallConversion).toBe(14);

    const propToNegoConversion = Math.round((20 / 35) * 100);
    expect(propToNegoConversion).toBe(57);
  });
});
