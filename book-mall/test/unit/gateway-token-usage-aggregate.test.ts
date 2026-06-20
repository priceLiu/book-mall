import { describe, expect, it } from "vitest";

import { isTextToVideoInput } from "@/lib/billing/byok-pricing";
import {
  aggregateGatewayTokenUsageFromLogs,
  matchesSeedance20ModelKey,
  resolveEffectiveLogTotalTokens,
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

describe("aggregateGatewayTokenUsageFromLogs", () => {
  it("splits image/video/text categories and seedance bucket", () => {
    const summary = aggregateGatewayTokenUsageFromLogs([
      {
        status: "SUCCEEDED",
        requestKind: "IMAGE",
        inputSummary: { input: { prompt: "画一只猫" } },
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
          input: { prompt: "口播", model: "doubao-seedance-2.0" },
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

    expect(summary.totalTokens).toBeGreaterThan(120);
    expect(summary.textToImageTokens).toBe(120);
    expect(summary.textToVideoTokens).toBeGreaterThan(0);
    expect(summary.textTokens).toBe(30);
    expect(summary.seedance20Tokens).toBe(summary.textToVideoTokens);
    expect(summary.succeededCalls).toBe(3);
  });

  it("resolveEffectiveLogTotalTokens falls back to prompt estimate", () => {
    const tokens = resolveEffectiveLogTotalTokens({
      status: "SUCCEEDED",
      requestKind: "VIDEO",
      inputSummary: { input: { prompt: "测试文生视频" } },
      resultSummary: null,
      billingCategory: "IMAGE_TO_VIDEO",
      model: "doubao-seedance-2.0",
      canonicalModelKey: null,
      totalTokens: null,
      promptTokens: null,
      completionTokens: null,
      hasTokenUsage: false,
      metricsSource: "UNAVAILABLE",
      tenantId: null,
      actorBookUserId: null,
    });
    expect(tokens).toBeGreaterThan(0);
  });
});
