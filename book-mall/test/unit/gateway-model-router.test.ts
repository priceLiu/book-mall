import { describe, expect, it } from "vitest";

import {
  routeGatewayModel,
  isBailianR2vGatewayModel,
  resolveDeepseekChatCompletionsBody,
  resolveBailianChatModelKey,
  resolveKimiChatCompletionsBody,
} from "@/lib/gateway/model-router";
import { resolveGatewayChatCompletionsBody } from "@/lib/gateway/proxy-common";

describe("routeGatewayModel · 百炼 R2V", () => {
  it("happyhorse-1.0-r2v 走 BAILIAN 而非 DASHSCOPE 前缀", () => {
    expect(routeGatewayModel("happyhorse-1.0-r2v")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "VIDEO",
    });
  });

  it("wan2.7-r2v 走 BAILIAN", () => {
    expect(routeGatewayModel("wan2.7-r2v")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "VIDEO",
    });
  });

  it("happyhorse-1.0-i2v 仍走 DASHSCOPE 图生视频", () => {
    expect(routeGatewayModel("happyhorse-1.0-i2v")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
  });

  it("happyhorse-1.1-t2v 走 DASHSCOPE 文生视频", () => {
    expect(routeGatewayModel("happyhorse-1.1-t2v")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
  });

  it("wan3.0-video 走 DASHSCOPE 视频（非百炼 R2V）", () => {
    expect(routeGatewayModel("wan3.0-video")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
    expect(isBailianR2vGatewayModel("wan3.0-video")).toBe(false);
  });

  it("wan3.0-video-prime 走 DASHSCOPE 视频（非百炼 R2V）", () => {
    expect(routeGatewayModel("wan3.0-video-prime")).toEqual({
      providerKind: "DASHSCOPE",
      requestKind: "VIDEO",
    });
    expect(isBailianR2vGatewayModel("wan3.0-video-prime")).toBe(false);
  });

  it("happyhorse-1.1-r2v 走 BAILIAN", () => {
    expect(routeGatewayModel("happyhorse-1.1-r2v")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "VIDEO",
    });
    expect(isBailianR2vGatewayModel("happyhorse-1.1-r2v")).toBe(true);
  });
});

describe("routeGatewayModel · MiniMax H3", () => {
  it("MiniMax/MiniMax-H3-i2v 走 MINIMAX VIDEO", () => {
    expect(routeGatewayModel("MiniMax/MiniMax-H3-i2v")).toEqual({
      providerKind: "MINIMAX",
      requestKind: "VIDEO",
    });
  });

  it("MiniMax/MiniMax-H3-r2v 走 MINIMAX VIDEO（不得误落 DashScope -r2v 启发式）", () => {
    expect(routeGatewayModel("MiniMax/MiniMax-H3-r2v")).toEqual({
      providerKind: "MINIMAX",
      requestKind: "VIDEO",
    });
  });

  it("MiniMax/MiniMax-H3-context-ir 走 MINIMAX VIDEO", () => {
    expect(routeGatewayModel("MiniMax/MiniMax-H3-context-ir")).toEqual({
      providerKind: "MINIMAX",
      requestKind: "VIDEO",
    });
  });

  it("minimax speech 仍走 TTS", () => {
    expect(routeGatewayModel("speech-2.8-hd")).toEqual({
      providerKind: "MINIMAX",
      requestKind: "TTS",
    });
  });
});

describe("routeGatewayModel · Kimi", () => {
  it("kimi-k3 走百炼代销（非 Moonshot 直连）", () => {
    expect(routeGatewayModel("kimi-k3")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "CHAT",
    });
  });

  it("kimi/kimi-k3 走百炼", () => {
    expect(routeGatewayModel("kimi/kimi-k3")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "CHAT",
    });
  });

  it("kimi-k2.6 走百炼", () => {
    expect(routeGatewayModel("kimi-k2.6")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "CHAT",
    });
  });

  it("moonshot-v1-128k 仍走 Moonshot legacy", () => {
    expect(routeGatewayModel("moonshot-v1-128k")).toEqual({
      providerKind: "MOONSHOT",
      requestKind: "CHAT",
    });
  });
});

describe("resolveBailianChatModelKey · Kimi", () => {
  it("maps short Kimi ids to 百炼 upstream ids", () => {
    expect(resolveBailianChatModelKey("kimi-k3")).toBe("kimi/kimi-k3");
    expect(resolveBailianChatModelKey("kimi-k2.6")).toBe("kimi/kimi-k2.6");
    expect(resolveBailianChatModelKey("kimi-k2.7-code")).toBe("kimi/kimi-k2.7-code");
  });
});

describe("resolveKimiChatCompletionsBody", () => {
  it("strips temperature/top_p for kimi-k3", () => {
    const body = resolveKimiChatCompletionsBody({
      model: "kimi-k3",
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 24000,
      reasoning_effort: "low",
    });
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
    expect(body.max_tokens).toBe(24000);
    expect(body.reasoning_effort).toBe("low");
  });
});

describe("resolveGatewayChatCompletionsBody · Kimi 百炼", () => {
  it("DASHSCOPE 凭证路由 + kimi-k3 仍剥离 temperature 并映射 upstream model", () => {
    const body = resolveGatewayChatCompletionsBody("DASHSCOPE", {
      model: "kimi-k3",
      temperature: 0.7,
      max_tokens: 24000,
      messages: [],
    });
    expect(body.model).toBe("kimi/kimi-k3");
    expect(body.temperature).toBeUndefined();
  });

  it("BAILIAN 路由 + kimi-k3 同样剥离 temperature", () => {
    const body = resolveGatewayChatCompletionsBody("BAILIAN", {
      model: "kimi-k3",
      temperature: 0.7,
      max_tokens: 8000,
      messages: [],
    });
    expect(body.model).toBe("kimi/kimi-k3");
    expect(body.temperature).toBeUndefined();
  });
});

describe("resolveDeepseekChatCompletionsBody", () => {
  it("maps thinking_mode to thinking.type and resolves legacy model id", () => {
    const body = resolveDeepseekChatCompletionsBody({
      model: "deepseek-chat",
      thinking_mode: "enabled",
      reasoning_effort: "high",
      temperature: 0.7,
      max_tokens: 24000,
    });
    expect(body.model).toBe("deepseek-v4-flash");
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(body.thinking_mode).toBeUndefined();
    expect(body.reasoning_effort).toBe("high");
  });

  it("drops reasoning_effort when thinking disabled", () => {
    const body = resolveDeepseekChatCompletionsBody({
      model: "deepseek-v4-flash",
      thinking_mode: "disabled",
      reasoning_effort: "low",
      max_tokens: 8000,
    });
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body.reasoning_effort).toBeUndefined();
  });
});
