import { describe, expect, it } from "vitest";

import { resolveGatewayLogDisplayModelKey } from "@/lib/gateway/gateway-log-display-model";

describe("resolveGatewayLogDisplayModelKey", () => {
  it("prefers stored canonicalModelKey", () => {
    expect(
      resolveGatewayLogDisplayModelKey({
        model: "doubao-seedance-2.0",
        canonicalModelKey: "seedance-2.0-720p-real",
      }),
    ).toBe("seedance-2.0-720p-real");
  });

  it("infers sbv1 tier from inputSummary when canonical missing", () => {
    expect(
      resolveGatewayLogDisplayModelKey({
        model: "doubao-seedance-2.0",
        canonicalModelKey: null,
        inputSummary: {
          model: "doubao-seedance-2.0",
          input: {
            resolution: "720p",
            sbv1Billing: { edition: "sbv1", volcengineVariantId: "seedance-2-720p-real" },
          },
        },
      }),
    ).toBe("seedance-2.0-720p-real");
  });

  it("falls back to vendor model key when not seedance", () => {
    expect(
      resolveGatewayLogDisplayModelKey({
        model: "deepseek-v4-flash",
        canonicalModelKey: null,
        inputSummary: { model: "deepseek-v4-flash", input: {} },
      }),
    ).toBe("deepseek-v4-flash");
  });
});
