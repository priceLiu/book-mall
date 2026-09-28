import { describe, expect, it } from "vitest";

import { collectEcomGatewayLogIds } from "@/lib/ecom-credits-settlement-watch";

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
