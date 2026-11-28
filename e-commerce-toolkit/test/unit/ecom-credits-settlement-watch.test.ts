import { describe, expect, it } from "vitest";

import { collectEcomGatewayLogIds, creditsConsumedDetail } from "../../lib/ecom-credits-settlement-watch";

describe("collectEcomGatewayLogIds", () => {
  it("collects top-level gateway log ids", () => {
    expect(
      collectEcomGatewayLogIds({
        logId: "cllog111111111",
        logIds: ["cllog222222222", ""],
        shots: [{ logId: "cllog333333333" }],
        ok: true,
      }),
    ).toEqual(["cllog111111111", "cllog222222222"]);
  });
});

describe("creditsConsumedDetail", () => {
  it("turns a color-grade charge into the consumption toast payload", () => {
    expect(
      creditsConsumedDetail({
        imageUrl: "https://example.com/a.jpg",
        creditsCharged: 0.5,
        chargeId: "cmledger123456",
      }),
    ).toEqual({ logId: "cmledger123456", phase: "consumed", credits: 0.5 });
  });

  it("skips when nothing was charged", () => {
    expect(creditsConsumedDetail({ imageUrl: "https://example.com/a.jpg", creditsCharged: 0 })).toBeNull();
    expect(creditsConsumedDetail({ creditsCharged: 0.5, chargeId: "short" })).toBeNull();
  });
});
