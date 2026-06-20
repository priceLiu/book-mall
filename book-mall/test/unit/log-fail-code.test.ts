import { describe, expect, it } from "vitest";

import {
  inferGatewayFailCode,
  isContentPolicyFailMessage,
  resolveGatewayFailCodeDisplay,
} from "@/lib/gateway/log-fail-code";

describe("inferGatewayFailCode", () => {
  it("keeps explicit failCode", () => {
    expect(inferGatewayFailCode({ failCode: "STALE_TIMEOUT" })).toBe(
      "STALE_TIMEOUT",
    );
  });

  it("infers CONTENT_POLICY from sensitive message", () => {
    expect(
      inferGatewayFailCode({
        failMessage:
          "The input or output was flagged as sensitive. Please try again with different inputs.",
      }),
    ).toBe("CONTENT_POLICY");
  });

  it("uses upstreamCode when failCode empty", () => {
    expect(
      inferGatewayFailCode({ upstreamCode: "RATE_LIMIT", failMessage: "429" }),
    ).toBe("RATE_LIMIT");
  });
});

describe("resolveGatewayFailCodeDisplay", () => {
  it("falls back to FAILED", () => {
    expect(resolveGatewayFailCodeDisplay({})).toBe("FAILED");
  });
});

describe("isContentPolicyFailMessage", () => {
  it("detects english sensitive flag", () => {
    expect(
      isContentPolicyFailMessage("flagged as sensitive"),
    ).toBe(true);
  });
});
