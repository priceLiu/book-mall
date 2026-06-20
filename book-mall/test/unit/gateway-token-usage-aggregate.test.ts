import { describe, expect, it } from "vitest";

import { isTextToVideoInput } from "@/lib/billing/byok-pricing";
import {
  aggregateGatewayTokenUsageFromLogs,
  matchesSeedance20ModelKey,
  resolveEffectiveLogKTokens,
} from "@/lib/gateway/gateway-token-usage-aggregate";

describe("matchesSeedance20ModelKey", () => {
  it("matches volcengine and kie seedance 2.0 keys", () => {
    expect(matchesSeedance20ModelKey("doubao-seedance-2.0")).toBe(true);
    expect(matchesSeedance20ModelKey("bytedance/seedance-2")).toBe(true);
    expect(matchesSeedance20ModelKey("seedance-2.0-720p-real")).toBe(true);
    expect(matchesSeedance20ModelKey("doubao-seedance-1.5-pro")).toBe(false);
  });
});

describe("isTextToVideoInput", () => {
  it("detects prompt-only video as text-to-video", () => {
    expect(
      isTextToVideoInput({
        input: { prompt: "一只猫在跑步", model: "doubao-seedance-2.0" },
      }),
    ).toBe(true);
  });

  it("treats first-frame video as image-to-video", () => {
    expect(
      isTextToVideoInput({
        input: {
          prompt: "动起来",
          imageUrl: "https://example.com/frame.jpg",
        },
      }),
    ).toBe(false);
  });
});

describe("aggregateGatewayTokenUsageFromLogs — billing units", () => {
  it("uses images for TEXT_TO_IMAGE and seconds for video", () => {
    const summary = aggregateGatewayTokenUsageFromLogs([
      {
        status: "SUCCEEDED",
        requestKind: "IMAGE",
        inputSummary: {
          input: { prompt: "画一只猫", referenceImageUrls: ["a", "b"] },
        },
        resultSummary: null,
        billingCategory: "TEXT_TO_IMAGE",
        model: "flux-2-pro",
        canonicalModelKey: null,
        totalTokens: 120,
        promptTokens: 120,
        completionTokens: null,
        hasTokenUsage: true,
        metricsSource: "VENDOR",
        tenantId: null,
        actorBookUserId: "u1",
      },
      {
        status: "SUCCEEDED",
        requestKind: "VIDEO",
        inputSummary: {
          input: { prompt: "口播", model: "doubao-seedance-2.0", duration: 10 },
        },
        resultSummary: null,
        billingCategory: "IMAGE_TO_VIDEO",
        model: "doubao-seedance-2.0",
        canonicalModelKey: "seedance-2.0-720p-real",
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        hasTokenUsage: false,
        metricsSource: "UNAVAILABLE",
        tenantId: null,
        actorBookUserId: "u1",
      },
      {
        status: "SUCCEEDED",
        requestKind: "CHAT",
        inputSummary: { input: { messages: [{ role: "user", content: "你好" }] } },
        resultSummary: { choices: [{ message: { content: "嗨" } }] },
        billingCategory: "TEXT",
        model: "qwen-plus",
        canonicalModelKey: null,
        totalTokens: 30,
        promptTokens: 10,
        completionTokens: 20,
        hasTokenUsage: true,
        metricsSource: "VENDOR",
        tenantId: null,
        actorBookUserId: "u1",
      },
    ]);

    expect(summary.textToImageImages).toBe(2);
    expect(summary.textToVideoSeconds).toBe(10);
    expect(summary.textKTokens).toBe(1);
    expect(summary.seedance20Seconds).toBe(10);
    expect(summary.succeededCalls).toBe(3);
  });

  it("counts portrait library import as otherCalls (次)", () => {
    const summary = aggregateGatewayTokenUsageFromLogs([
      {
        status: "SUCCEEDED",
        requestKind: "OTHER",
        inputSummary: { model: "portrait:virtual" },
        resultSummary: null,
        billingCategory: null,
        model: "portrait:virtual",
        canonicalModelKey: null,
        totalTokens: null,
        promptTokens: null,
        completionTokens: null,
        hasTokenUsage: false,
        metricsSource: "UNAVAILABLE",
        tenantId: null,
        actorBookUserId: "u1",
      },
    ]);
    expect(summary.otherCalls).toBe(1);
    expect(summary.textToImageImages).toBe(0);
  });

  it("resolveEffectiveLogKTokens rounds up to kToken", () => {
    expect(
      resolveEffectiveLogKTokens({
        status: "SUCCEEDED",
        requestKind: "CHAT",
        inputSummary: { input: { messages: [{ role: "user", content: "x" }] } },
        resultSummary: null,
        billingCategory: "TEXT",
        model: "qwen-plus",
        canonicalModelKey: null,
        totalTokens: 1500,
        promptTokens: 1500,
        completionTokens: null,
        hasTokenUsage: true,
        metricsSource: "VENDOR",
        tenantId: null,
        actorBookUserId: null,
      }),
    ).toBe(2);
  });
});
