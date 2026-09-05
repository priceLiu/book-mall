import { MediaRenderJobStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { isMediaRenderConcurrencySlot } from "@/lib/media/media-render-concurrency";

describe("media render concurrency slots", () => {
  it("treats pending jobs as active slots", () => {
    expect(
      isMediaRenderConcurrencySlot({
        status: MediaRenderJobStatus.PENDING,
        progress: 0,
        progressLabel: "排队中",
      }),
    ).toBe(true);
  });

  it("treats running ffmpeg jobs as active slots", () => {
    expect(
      isMediaRenderConcurrencySlot({
        status: MediaRenderJobStatus.RUNNING,
        progress: 42,
        progressLabel: "合成中",
      }),
    ).toBe(true);
  });

  it("does not count upload-phase jobs against the limit", () => {
    expect(
      isMediaRenderConcurrencySlot({
        status: MediaRenderJobStatus.RUNNING,
        progress: 92,
        progressLabel: "上传中 0%",
      }),
    ).toBe(false);
  });

  it("does not count upload-retry jobs against the limit", () => {
    expect(
      isMediaRenderConcurrencySlot({
        status: MediaRenderJobStatus.RUNNING,
        progress: 90,
        progressLabel: "云端上传失败，可重试",
      }),
    ).toBe(false);
  });

  it("ignores finished jobs", () => {
    expect(
      isMediaRenderConcurrencySlot({
        status: MediaRenderJobStatus.SUCCEEDED,
        progress: 100,
        progressLabel: "剪辑完成",
      }),
    ).toBe(false);
  });
});
