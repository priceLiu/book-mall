import { describe, expect, it } from "vitest";

import { isLibtvLocalMediaJobRuntime } from "@/lib/canvas/libtv-local-media-job";
import {
  formatVideoTrackSplitClientError,
  libtvVideoTrackSplitSourceReady,
} from "@/lib/canvas/libtv-video-track-split-run";

describe("libtvVideoTrackSplitSourceReady", () => {
  it("prefers ossUrl over ephemeral", () => {
    expect(
      libtvVideoTrackSplitSourceReady({
        runtime: {
          ossUrl: "https://cdn.example.com/a.mp4",
          ephemeralUrl: "https://tmp.example.com/b.mp4",
        },
      }),
    ).toBe("https://cdn.example.com/a.mp4");
  });

  it("rejects blob and data urls", () => {
    expect(
      libtvVideoTrackSplitSourceReady({
        runtime: { ephemeralUrl: "blob:http://localhost/x" },
      }),
    ).toBeUndefined();
    expect(
      libtvVideoTrackSplitSourceReady({
        runtime: { ossUrl: "data:video/mp4;base64,abc" },
      }),
    ).toBeUndefined();
  });
});

describe("isLibtvLocalMediaJobRuntime", () => {
  it("matches video-track-split while running", () => {
    expect(
      isLibtvLocalMediaJobRuntime({
        status: "running",
        localJobKind: "video-track-split",
      }),
    ).toBe(true);
  });

  it("ignores done or missing kind", () => {
    expect(
      isLibtvLocalMediaJobRuntime({
        status: "done",
        localJobKind: "video-track-split",
      }),
    ).toBe(false);
    expect(isLibtvLocalMediaJobRuntime({ status: "running" })).toBe(false);
  });
});

describe("formatVideoTrackSplitClientError", () => {
  it("maps proxy failure", () => {
    expect(formatVideoTrackSplitClientError("book_mall_proxy_failed", 502)).toBe(
      "主站处理超时或连接中断，请稍后重试",
    );
  });

  it("maps raw OSS TLS dump", () => {
    expect(
      formatVideoTrackSplitClientError(
        "Client network socket disconnected before secure TLS connection was established, GET https://tool-mall.oss-cn-guangzhou.aliyuncs.com/x.mp4",
      ),
    ).toBe("成片读取或写入云存储失败，请稍后重试");
  });
});
