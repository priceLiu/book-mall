import { describe, expect, it } from "vitest";

import {
  hasVideoAttachmentInChatInput,
  mapLogToBillingTaskKind,
} from "@/lib/billing/gateway-log-classifier";

describe("mapLogToBillingTaskKind — 七类映射", () => {
  it("IMAGE / TRYON → 文生图", () => {
    expect(mapLogToBillingTaskKind({ requestKind: "IMAGE" })).toBe("TEXT_TO_IMAGE");
    expect(mapLogToBillingTaskKind({ requestKind: "TRYON" })).toBe("TEXT_TO_IMAGE");
  });

  it("TTS → TTS", () => {
    expect(mapLogToBillingTaskKind({ requestKind: "TTS" })).toBe("TTS");
  });

  it("CHAT + video_url → 视频理解；纯 CHAT → null", () => {
    const withVideo = {
      requestKind: "CHAT",
      inputSummary: {
        model: "qwen3-vl-plus",
        input: {
          messages: [
            {
              role: "user",
              content: [{ type: "video_url", video_url: { url: "data:video/mp4;base64,abc" } }],
            },
          ],
        },
      },
    };
    expect(mapLogToBillingTaskKind(withVideo)).toBe("VIDEO_UNDERSTANDING");
    expect(hasVideoAttachmentInChatInput(withVideo.inputSummary)).toBe(true);
    expect(
      mapLogToBillingTaskKind({ requestKind: "CHAT", inputSummary: { input: { messages: [] } } }),
    ).toBeNull();
  });

  it("VIDEO i2v vs v2v", () => {
    expect(mapLogToBillingTaskKind({ requestKind: "VIDEO" })).toBe("IMAGE_TO_VIDEO");
    expect(
      mapLogToBillingTaskKind({
        requestKind: "VIDEO",
        inputSummary: { mode: "v2v" },
      }),
    ).toBe("VIDEO_TO_VIDEO");
  });
});
