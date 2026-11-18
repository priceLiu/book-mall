import { describe, expect, it } from "vitest";

import { spendableCreditBalance } from "@/lib/billing/credit-account-service";

describe("spendableCreditBalance", () => {
  it("uses balance only (reserve already deducted from balance)", () => {
    expect(
      spendableCreditBalance({ balance: 110, reserved: 90, pricePerCreditYuan: null }),
    ).toBe(110);
  });

  it("clamps negative balance to zero", () => {
    expect(
      spendableCreditBalance({ balance: -1, reserved: 0, pricePerCreditYuan: null }),
    ).toBe(0);
  });
});