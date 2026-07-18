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

  it("resolves Kimi K3 via canonical registry", () => {
    expect(resolveKnownGatewayModelRegistration("kimi-k3")).toMatchObject({
      canonicalModelKey: "kimi-k3",
      providerKind: "MOONSHOT",
      vendor: "moonshot",
    });
  });

  it("returns null for unknown model keys", () => {
    expect(resolveKnownGatewayModelRegistration("not-a-real-model-key")).toBeNull();
  });

  it("resolves KIE GPT-5.5 chat", () => {
    expect(resolveKnownGatewayModelRegistration("gpt-5-5")).toMatchObject({
      canonicalModelKey: "gpt-5-5-chat",
      providerKind: "KIE",
    });
  });

  it("resolves Volcengine Doubao Seed 2.1 Pro vision", () => {
    expect(resolveKnownGatewayModelRegistration("doubao-seed-2.1-pro")).toMatchObject({
      canonicalModelKey: "doubao-seed-2.1-pro",
      providerKind: "VOLCENGINE",
      vendor: "volcengine",
    });
  });

  it("resolves Volcengine Doubao Seed 2.0 vision alias", () => {
    expect(resolveKnownGatewayModelRegistration("doubao-seed-2.0")).toMatchObject({
      canonicalModelKey: "doubao-seed-2.0",
      providerKind: "VOLCENGINE",
      vendor: "volcengine",
    });
  });
});
