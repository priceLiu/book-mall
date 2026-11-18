import { describe, expect, it } from "vitest";

import { pickGenerationBillingPool } from "@/lib/billing/credit-pre-check";

describe("pickGenerationBillingPool", () => {
  it("uses team when team has enough", () => {
    expect(
      pickGenerationBillingPool({
        teamSpendable: 500,
        personalSpendable: 5000,
        minNeeded: 450,
      }),
    ).toBe("team");
  });

  it("falls back to personal when team low but personal topped up", () => {
    expect(
      pickGenerationBillingPool({
        teamSpendable: 405.23,
        personalSpendable: 5405,
        minNeeded: 450,
      }),
    ).toBe("personal");
  });

  it("keeps team for error when both insufficient but team higher", () => {
    expect(
      pickGenerationBillingPool({
        teamSpendable: 200,
        personalSpendable: 50,
        minNeeded: 450,
      }),
    ).toBe("team");
  });
});