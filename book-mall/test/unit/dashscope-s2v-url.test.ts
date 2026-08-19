import { describe, expect, it } from "vitest";

import {
  S2V_CREATE_URL,
  VIDEO_CREATE_PATH,
  WAN30_MISSING_WORKSPACE_ERROR,
  resolveDashscopeS2vCreateUrl,
  resolveDashscopeS2vDetectUrl,
  resolveDashscopeVideoCreateUrl,
  resolveDashscopeVideoTaskPollBaseUrl,
  resolveDashscopeWan30VideoApiRoot,
} from "@/lib/gateway/dashscope-client";

const WS = "llm-abc123xyz";
const SK_WS_KEY = `sk-ws-prefix.${WS}.keyid.MEQfakeSigForTest`;
const BEIJING = `https://${WS}.cn-beijing.maas.aliyuncs.com`;

describe("dashscope S2V URLs", () => {
  it("uses vendor-confirmed image2video create endpoint", () => {
    expect(S2V_CREATE_URL).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/video-synthesis/",
    );
    expect(resolveDashscopeS2vCreateUrl(null)).toBe(S2V_CREATE_URL);
    expect(
      resolveDashscopeS2vCreateUrl(
        "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
      ),
    ).toBe(S2V_CREATE_URL);
  });

  it("uses image2video detect endpoint", () => {
    expect(resolveDashscopeS2vDetectUrl(null)).toBe(
      "https://dashscope.aliyuncs.com/api/v1/services/aigc/image2video/face-detect/",
    );
  });
});

describe("wan3.0-video MAAS endpoint", () => {
  it("creates on {WorkspaceId}.cn-beijing.maas.aliyuncs.com from sk-ws- key", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan3.0-video",
      apiKey: SK_WS_KEY,
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    expect(resolved).toEqual({
      ok: true,
      url: `${BEIJING}${VIDEO_CREATE_PATH}`,
    });
  });

  it("ignores S2V dashscope.aliyuncs.com baseUrl when deriving MAAS root", () => {
    expect(
      resolveDashscopeWan30VideoApiRoot(SK_WS_KEY, "https://dashscope.aliyuncs.com"),
    ).toBe(BEIJING);
  });

  it("uses stored MAAS baseUrl when present", () => {
    const sg = "https://ws-sg.ap-southeast-1.maas.aliyuncs.com";
    expect(resolveDashscopeWan30VideoApiRoot("sk-abc123", `${sg}/api/v1`)).toBe(sg);
  });

  it("rejects generic sk- keys that cannot resolve WorkspaceId", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan3.0-video",
      apiKey: "sk-abc123",
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    expect(resolved).toEqual({
      ok: false,
      error: WAN30_MISSING_WORKSPACE_ERROR,
    });
  });

  it("leaves wan2.6-t2v on dashscope.aliyuncs.com", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan2.6-t2v",
      apiKey: SK_WS_KEY,
    });
    expect(resolved).toEqual({
      ok: true,
      url: "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    });
  });

  it("polls wan3.0 on the same MAAS root", () => {
    expect(
      resolveDashscopeVideoTaskPollBaseUrl({
        model: "wan3.0-video",
        apiKey: SK_WS_KEY,
        storedBaseUrl: "https://dashscope.aliyuncs.com",
      }),
    ).toBe(BEIJING);
  });
});
