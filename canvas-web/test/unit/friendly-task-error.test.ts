import { describe, expect, it } from "vitest";
import {
  formatCanvasTaskError,
  inferLlmVendorFromModelKey,
  isGatewayImageModelKey,
} from "@/lib/canvas/friendly-task-error";

describe("isGatewayImageModelKey", () => {
  it("recognizes nano-banana as image", () => {
    expect(isGatewayImageModelKey("nano-banana-pro")).toBe(true);
  });

  it("does not treat nano-banana as LLM vendor", () => {
    expect(inferLlmVendorFromModelKey("nano-banana-pro")).toBe("unknown");
  });
});

describe("formatCanvasTaskError", () => {
  it("short image timeout message without Gemini hint", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "KIE API 连接超时（api.kie.ai）",
        "nano-banana-pro",
      ),
    ).toBe("生图服务暂时不可用，请稍后重试。");
  });

  it("short LLM timeout message", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "fetch failed",
        "google/gemini-3-flash",
      ),
    ).toBe("文本模型服务暂时不可用，请稍后重试。");
  });

  it("short KIE video timeout message", () => {
    expect(
      formatCanvasTaskError(
        "VIDEO_ENGINE_FAILED",
        "KIE API 连接超时，请稍后重试。",
        "kling-3.0/video",
      ),
    ).toBe("KIE 视频服务暂时不可用，请稍后重试。");
  });

  it("strips long gateway technical messages", () => {
    expect(
      formatCanvasTaskError(
        "REQUEST_FAILED",
        "Gateway 内部链路超时（book-mall 自调用 /api/gw/v1）",
        "nano-banana-pro",
      ),
    ).toBe("生图服务暂时不可用，请稍后重试。");
  });
});
