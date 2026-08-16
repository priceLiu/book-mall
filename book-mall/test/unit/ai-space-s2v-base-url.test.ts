import { describe, expect, it } from "vitest";

import { resolveAiSpaceS2vBaseUrl } from "@/lib/ai-space/ai-space-gateway-auth";
import { parseDashscopeWorkspaceIdFromApiKey } from "@/lib/gateway/dashscope-client";

const WS = "llm-abc123xyz";
const SK_WS_KEY = `sk-ws-prefix.${WS}.keyid.MEQfakeSigForTest`;
const BEIJING = `https://${WS}.cn-beijing.maas.aliyuncs.com`;
const GENERIC = "https://dashscope.aliyuncs.com";

describe("parseDashscopeWorkspaceIdFromApiKey", () => {
  it("解析标准 sk-ws Key", () => {
    expect(parseDashscopeWorkspaceIdFromApiKey(SK_WS_KEY)).toBe(WS);
  });

  it("尾段非 MEQ 前缀时仍取第二段 workspaceId", () => {
    expect(parseDashscopeWorkspaceIdFromApiKey(`sk-ws-p.${WS}.kid.otherSig`)).toBe(
      WS,
    );
  });

  it("普通 sk- Key 返回 null", () => {
    expect(parseDashscopeWorkspaceIdFromApiKey("sk-abc123")).toBeNull();
  });
});

describe("resolveAiSpaceS2vBaseUrl", () => {
  it("sk-ws Key 使用 DashScope 通用根域名，忽略华北2子域", () => {
    expect(resolveAiSpaceS2vBaseUrl(SK_WS_KEY, BEIJING)).toBe(GENERIC);
  });

  it("sk-ws Key 忽略 compatible-mode baseUrl", () => {
    expect(
      resolveAiSpaceS2vBaseUrl(
        SK_WS_KEY,
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
      ),
    ).toBe(GENERIC);
  });

  it("无 sk-ws 时使用已存的非 DashScope baseUrl", () => {
    expect(
      resolveAiSpaceS2vBaseUrl("sk-legacy", "https://custom.example.com/api/v1"),
    ).toBe("https://custom.example.com");
  });

  it("无 sk-ws 且无 baseUrl 时回退通用域名", () => {
    expect(resolveAiSpaceS2vBaseUrl("sk-legacy", null)).toBe(GENERIC);
  });
});
