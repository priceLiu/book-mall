import { describe, expect, it } from "vitest";

import {
  S2V_CREATE_URL,
  resolveDashscopeS2vCreateUrl,
  resolveDashscopeS2vDetectUrl,
} from "@/lib/gateway/dashscope-client";

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
