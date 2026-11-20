import { describe, expect, it } from "vitest";

import {
  resolveVolcengineLayerOutputBillableCount,
  resolveVolcengineLayerPricingTier,
  volcengineSeedream55LayerInputSurchargeCredits,
  VOLCENGINE_SEEDREAM_LAYER_TIER,
} from "@/lib/gateway/volcengine-seedream-layer-billing";
import { resolveBillableImageCountFromLog } from "@/lib/gateway/log-billing-metrics";

describe("volcengine-seedream-layer-billing", () => {
  const layerInput = {
    input: {
      layerDecomposition: true,
      parameters: { layer_decomposition: true },
    },
  };

  it("uses LAYER tier for Pro/5.5 layer_decomposition", () => {
    expect(
      resolveVolcengineLayerPricingTier({
        model: "doubao-seedream-5-0-pro",
        canonicalModelKey: "doubao-seedream-5-0-pro",
        inputSummary: layerInput,
      }),
    ).toBe(VOLCENGINE_SEEDREAM_LAYER_TIER);
    expect(
      resolveVolcengineLayerPricingTier({
        model: "doubao-seedream-5-5",
        canonicalModelKey: "doubao-seedream-5-5",
        inputSummary: layerInput,
      }),
    ).toBe(VOLCENGINE_SEEDREAM_LAYER_TIER);
  });

  it("counts output layers for billing", () => {
    expect(
      resolveVolcengineLayerOutputBillableCount({
        inputSummary: layerInput,
        resultSummary: { outputLayerCount: 4, imageCount: 1 },
      }),
    ).toBe(4);
    expect(
      resolveBillableImageCountFromLog({
        inputSummary: layerInput,
        resultSummary: { outputLayerCount: 4 },
      }),
    ).toBe(4);
  });

  it("adds 5.5 input-image surcharge credits", () => {
    const credits = volcengineSeedream55LayerInputSurchargeCredits(1, 0.03);
    expect(credits).toBeGreaterThan(2);
    expect(credits).toBeLessThan(3.5);
  });
});