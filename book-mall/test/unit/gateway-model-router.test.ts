import { describe, expect, it } from "vitest";

import { routeGatewayModel, isBailianR2vGatewayModel } from "@/lib/gateway/model-router";

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

describe("routeGatewayModel · Kimi K3", () => {
  it("kimi-k3 走 Moonshot 直连（非百炼 kimi/kimi-k3）", () => {
    expect(routeGatewayModel("kimi-k3")).toEqual({
      providerKind: "MOONSHOT",
      requestKind: "CHAT",
    });
  });

  it("kimi/kimi-k3 仍走百炼第三方区", () => {
    expect(routeGatewayModel("kimi/kimi-k3")).toEqual({
      providerKind: "BAILIAN",
      requestKind: "CHAT",
    });
  });
});
