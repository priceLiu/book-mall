import { describe, expect, it } from "vitest";

import { resolveKnownGatewayModelRegistration } from "@/lib/gateway/model-registry";

describe("resolveKnownGatewayModelRegistration", () => {
  it("resolves Story LLM Gemini 3 via canonical registry", () => {
    expect(
      resolveKnownGatewayModelRegistration("google/gemini-3-flash-preview"),
    ).toMatchObject({
      canonicalModelKey: "gemini-flash",
      providerKind: "KIE",
      vendor: "kie",
    });
  });

  it("resolves DeepSeek V4 Flash via canonical registry", () => {
    expect(resolveKnownGatewayModelRegistration("deepseek-v4-flash")).toMatchObject({
      canonicalModelKey: "deepseek-chat",
      providerKind: "DEEPSEEK",
      vendor: "deepseek",
    });
  });

  it("returns null for unknown model keys", () => {
    expect(resolveKnownGatewayModelRegistration("not-a-real-model-key")).toBeNull();
  });
});
