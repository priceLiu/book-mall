import { describe, expect, it } from "vitest";
import { libtvRuntimeErrorAlertTitle } from "@/lib/canvas/libtv-runtime-error-alert";

describe("libtvRuntimeErrorAlertTitle", () => {
  it("uses image title for image kind", () => {
    expect(
      libtvRuntimeErrorAlertTitle(
        "REQUEST_FAILED",
        "生图服务暂时不可用，请稍后重试。",
        "image",
      ),
    ).toBe("图片生成失败");
  });

  it("uses video title for video kind", () => {
    expect(
      libtvRuntimeErrorAlertTitle(
        "VIDEO_ENGINE_FAILED",
        "KIE 视频服务暂时不可用，请稍后重试。",
        "video",
      ),
    ).toBe("视频生成失败");
  });

  it("infers image title from message when kind omitted", () => {
    expect(
      libtvRuntimeErrorAlertTitle("REQUEST_FAILED", "生图服务暂时不可用，请稍后重试。"),
    ).toBe("图片生成失败");
  });

  it("returns credits title for insufficient credits", () => {
    expect(libtvRuntimeErrorAlertTitle("INSUFFICIENT_CREDITS", "积分不足")).toBe(
      "积分不足",
    );
  });
});
