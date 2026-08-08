import { describe, expect, it } from "vitest";

import {
  computeLlmSplitChargeCredits,
  computeSplitTokenCreditPrice,
} from "@/lib/pricing/credit-pricing-formulas";
import { ktokenFromMillion } from "@/lib/pricing/gateway-bailian-price-catalog";

describe("LLM split billing", () => {
  it("publish split token price from ali kimi 20/100 per million", () => {
    const split = computeSplitTokenCreditPrice({
      inputListCostYuan: ktokenFromMillion(20),
      outputListCostYuan: ktokenFromMillion(100),
      discountRate: 0,
      marginM: 2.5,
      anchorYuan: 0.04,
    });
    expect(split.inputCreditsPerKToken).toBeGreaterThan(0);
    expect(split.outputCreditsPerKToken).toBeGreaterThan(split.inputCreditsPerKToken);
  });

  it("charges prompt and completion tokens separately", () => {
    const split = computeSplitTokenCreditPrice({
      inputListCostYuan: ktokenFromMillion(20),
      outputListCostYuan: ktokenFromMillion(100),
      discountRate: 0,
      marginM: 2.5,
      anchorYuan: 0.04,
    });
    const credits = computeLlmSplitChargeCredits({
      inputCreditsPerKToken: split.inputCreditsPerKToken,
      outputCreditsPerKToken: split.outputCreditsPerKToken,
      inputListPriceYuan: split.inputListPriceYuan,
      outputListPriceYuan: split.outputListPriceYuan,
      creditsPerUnit: split.inputCreditsPerKToken,
      listPriceYuan: split.inputListPriceYuan,
      promptTokens: 4000,
      completionTokens: 2000,
      pricePerCreditYuan: 0.04,
    });
    expect(credits).toBeGreaterThan(split.inputCreditsPerKToken);
  });
});
