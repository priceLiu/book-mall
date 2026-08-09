import { describe, expect, it } from "vitest";

import { kieCreditsToYuan, KIE_CREDIT_YUAN } from "@/lib/pricing/kie-pricing-constants";
import {
  resolveKieRoutePrice,
  specToListCostYuan,
  type KiePricingApiRow,
} from "@/lib/pricing/kie-pricing-match";

describe("kie pricing constants", () => {
  it("converts credits to yuan at standard recharge rate", () => {
    expect(KIE_CREDIT_YUAN).toBe(0.036);
    expect(kieCreditsToYuan(63)).toBeCloseTo(2.268, 6);
  });
});

describe("resolveKieRoutePrice", () => {
  const rows: KiePricingApiRow[] = [
    {
      modelDescription: "bytedance/seedance-2, 720p no video input",
      interfaceType: "video",
      provider: "ByteDance",
      creditPrice: "41",
      creditUnit: "per second",
      usdPrice: "0.205",
    },
    {
      modelDescription: "gpt-5.5, Chat, Input",
      interfaceType: "chat",
      provider: "OpenAI",
      creditPrice: "280",
      creditUnit: "per million tokens",
      usdPrice: "1.4",
    },
    {
      modelDescription: "gpt-5.5, Chat, Output",
      interfaceType: "chat",
      provider: "OpenAI",
      creditPrice: "1680",
      creditUnit: "per million tokens",
      usdPrice: "8.4",
    },
  ];

  it("maps seedance-2 KIE route to per-second credits", () => {
    const resolved = resolveKieRoutePrice(
      {
        canonicalModelKey: "kie-seedance-2.0",
        displayName: "Seedance 2.0 (KIE)",
        modelKey: "bytedance/seedance-2",
        providerKind: "KIE",
        vendor: "kie",
        requestKind: "VIDEO",
      },
      rows,
    );
    expect(resolved?.kind).toBe("video");
    if (resolved?.kind !== "video") return;
    const cost = specToListCostYuan(resolved);
    expect(cost.unit).toBe("PER_SEC");
    expect(cost.listCostYuan).toBeCloseTo(41 * 0.036, 6);
  });

  it("maps gpt-5-5 to token in/out", () => {
    const resolved = resolveKieRoutePrice(
      {
        canonicalModelKey: "gpt-5-5-chat",
        displayName: "GPT-5.5 Chat",
        modelKey: "gpt-5-5",
        providerKind: "KIE",
        vendor: "kie",
        requestKind: "CHAT",
      },
      rows,
    );
    expect(resolved?.kind).toBe("token");
    if (resolved?.kind !== "token") return;
    const cost = specToListCostYuan(resolved);
    expect(cost.inputListCostYuan).toBeCloseTo(0.01008, 6);
    expect(cost.outputListCostYuan).toBeCloseTo(0.06048, 6);
  });
});
