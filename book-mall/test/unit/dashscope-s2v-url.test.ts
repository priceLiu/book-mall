import { describe, expect, it } from "vitest";

import {
  S2V_CREATE_URL,
  VIDEO_CREATE_PATH,
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

describe("wan3.0-video endpoint", () => {
  const DASHSCOPE_VIDEO =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis";

  it("uses dashscope.aliyuncs.com with sk-ws key when baseUrl is shared domain", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan3.0-video",
      apiKey: SK_WS_KEY,
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    expect(resolved).toEqual({ ok: true, url: DASHSCOPE_VIDEO });
  });

  it("does not derive MAAS from sk-ws key segments (unreliable WorkspaceId)", () => {
    expect(
      resolveDashscopeWan30VideoApiRoot(SK_WS_KEY, "https://dashscope.aliyuncs.com"),
    ).toBeNull();
  });

  it("uses stored MAAS baseUrl when explicitly configured", () => {
    const sg = "https://ws-sg.ap-southeast-1.maas.aliyuncs.com";
    expect(resolveDashscopeWan30VideoApiRoot("sk-abc123", `${sg}/api/v1`)).toBe(sg);
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan3.0-video",
      apiKey: "sk-abc123",
      baseUrl: `${BEIJING}/api/v1`,
    });
    expect(resolved).toEqual({
      ok: true,
      url: `${BEIJING}${VIDEO_CREATE_PATH}`,
    });
  });

  it("allows generic sk- keys on dashscope shared domain", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan3.0-video",
      apiKey: "sk-abc123",
      baseUrl: "https://dashscope.aliyuncs.com",
    });
    expect(resolved).toEqual({ ok: true, url: DASHSCOPE_VIDEO });
  });

  it("leaves wan2.6-t2v on dashscope.aliyuncs.com", () => {
    const resolved = resolveDashscopeVideoCreateUrl({
      model: "wan2.6-t2v",
      apiKey: SK_WS_KEY,
    });
    expect(resolved).toEqual({ ok: true, url: DASHSCOPE_VIDEO });
  });

  it("polls wan3.0 on dashscope when no explicit MAAS baseUrl", () => {
    expect(
      resolveDashscopeVideoTaskPollBaseUrl({
        model: "wan3.0-video",
        apiKey: SK_WS_KEY,
        storedBaseUrl: "https://dashscope.aliyuncs.com",
      }),
    ).toBeNull();
  });
});
