import { describe, expect, it } from "vitest";

import { estimateGatewayLogNetCostYuan } from "@/lib/finance/gateway-log-line-cost";

describe("gateway-log-line-cost", () => {
  it("multiplies unit net cost by billable video seconds", () => {
    expect(
      estimateGatewayLogNetCostYuan({
        status: "SUCCEEDED",
        requestKind: "VIDEO",
        costSnapshotYuan: 0.1,
        inputSummary: { input: { duration: 5 } },
        resultSummary: { usage: { output_video_duration: 10 } },
        billingCategory: null,
        model: "happyhorse-1.1-t2v",
        canonicalModelKey: "happyhorse-1.1-t2v",
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        hasTokenUsage: false,
        metricsSource: null,
        tenantId: null,
        actorBookUserId: "u1",
        apiKeyId: "k1",
        clientPage: null,
      }),
    ).toBeCloseTo(1, 5);
  });

  it("multiplies unit net cost by image count", () => {
    expect(
      estimateGatewayLogNetCostYuan({
        status: "SUCCEEDED",
        requestKind: "IMAGE",
        costSnapshotYuan: 0.2,
        inputSummary: {
          model: "wan2.7-image",
          input: { referenceImageUrls: ["https://a", "https://b", "https://c"] },
        },
        resultSummary: null,
        billingCategory: null,
        model: "wan2.7-image",
        canonicalModelKey: "wan2.7-image",
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        hasTokenUsage: false,
        metricsSource: null,
        tenantId: null,
        actorBookUserId: "u1",
        apiKeyId: "k1",
        clientPage: null,
      }),
    ).toBeCloseTo(0.6, 5);
  });
});
