import { describe, expect, it } from "vitest";
import { mediaRenderErrorMessage } from "@/lib/media/media-render-errors";

describe("mediaRenderErrorMessage", () => {
  it("maps stderr maxBuffer to user-friendly text", () => {
    expect(
      mediaRenderErrorMessage(new Error("stderr maxBuffer length exceeded")),
    ).toBe("剪辑进程输出异常，请稍后重试；若多次失败请联系客服。");
  });

  it("maps ffmpeg timeout to user-friendly text", () => {
    expect(
      mediaRenderErrorMessage(new Error("ffmpeg 执行超时（45 分钟）")),
    ).toBe("剪辑耗时过长已超时，请减少分镜数量或降低输出画质后重试。");
  });

  it("maps fetch failed download to user-friendly text", () => {
    expect(mediaRenderErrorMessage(new Error("fetch failed"))).toBe(
      "下载分镜视频失败，请确认视频链接可访问后重试。",
    );
  });
});
