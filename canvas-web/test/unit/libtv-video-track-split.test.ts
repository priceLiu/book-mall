import { describe, expect, it } from "vitest";

import { isLibtvLocalMediaJobRuntime } from "@/lib/canvas/libtv-local-media-job";
import { pickSbv1LocalEditedVideoUrl } from "@/lib/canvas/libtv-local-video-edit-result";
import {
  clipSecFromTrackClientX,
  isClipRangeStillFullLength,
} from "@/lib/canvas/libtv-video-clip-editor-format";
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

describe("clip timeline pointer mapping", () => {
  it("maps a scaled dock rect without using unscaled scrollWidth", () => {
    const sec = clipSecFromTrackClientX(100 + 1728, 100, 2304, 15);
    expect(sec).toBeCloseTo(11.25, 2);
  });

  it("treats a near-full range as not trimmed", () => {
    expect(isClipRangeStillFullLength(0, 14.9, 15)).toBe(true);
    expect(isClipRangeStillFullLength(2, 8, 15)).toBe(false);
  });
});

describe("pickSbv1LocalEditedVideoUrl", () => {
  it("keeps trim clip url even when taskId is present", () => {
    expect(
      pickSbv1LocalEditedVideoUrl({
        label: "剪辑片段 · 4.0s",
        trimClipMeta: { durationSec: 4 },
        ossUrl: "https://cdn.example/clip.mp4",
        runtime: {
          status: "done",
          taskId: "task_stale",
          ossUrl: "https://cdn.example/clip.mp4",
        },
      }),
    ).toBe("https://cdn.example/clip.mp4");
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
