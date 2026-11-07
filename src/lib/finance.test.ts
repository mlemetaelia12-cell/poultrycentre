import { describe, expect, it } from "vitest";
import { calculateExpectedCash, calculateProfitMetrics, toCents } from "./finance";

describe("financial calculations", () => {
  it("calculates gross and net profit without counting stock purchases as expenses", () => {
    expect(calculateProfitMetrics(150_000, 90_000, 12_000)).toEqual({
      grossProfit: 60_000,
      netProfit: 48_000,
    });
  });

  it("allows a negative net profit when operating expenses exceed gross profit", () => {
    expect(calculateProfitMetrics(30_000, 20_000, 15_000).netProfit).toBe(-5_000);
  });

  it("reconciles cash using opening float, cash collections and cash outflows", () => {
    expect(calculateExpectedCash(50_000, 120_000, 8_000, 40_000)).toBe(122_000);
  });

  it("rounds money to cents consistently", () => {
    expect(toCents(1.005)).toBe(101);
    expect(toCents(12.34)).toBe(1234);
  });

  it("rejects non-finite monetary values", () => {
    expect(() => toCents(Number.NaN)).toThrow("finite number");
  });
});
