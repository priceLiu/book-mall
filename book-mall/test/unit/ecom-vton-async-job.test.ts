import { describe, expect, it } from "vitest";

import {
  isVtonAsyncJobRunning,
  sanitizeVtonModelPipelineJob,
  sanitizeVtonTextTryonJob,
  VTON_ASYNC_JOB_STALE_MS,
} from "@/lib/ecom/ecom-vton/async-job";

describe("vton async job", () => {
  it("treats a fresh running job as active", () => {
    expect(
      isVtonAsyncJobRunning({
        status: "running",
        startedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it("treats done/failed/stale jobs as not running", () => {
    expect(isVtonAsyncJobRunning({ status: "done", startedAt: new Date().toISOString() })).toBe(
      false,
    );
    expect(
      isVtonAsyncJobRunning({
        status: "running",
        startedAt: new Date(Date.now() - VTON_ASYNC_JOB_STALE_MS - 1000).toISOString(),
      }),
    ).toBe(false);
  });

  it("sanitizes text tryon and model pipeline jobs", () => {
    const text = sanitizeVtonTextTryonJob({
      jobId: "t1",
      status: "running",
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      prompt: "穿上这件外套",
      modelKey: "wan2.7-image-pro",
      imageSize: "1080*1440",
    });
    expect(text?.jobId).toBe("t1");
    expect(text?.modelKey).toBe("wan2.7-image-pro");

    const pipeline = sanitizeVtonModelPipelineJob({
      jobId: "m1",
      status: "failed",
      kind: "expanding-full-body",
      startedAt: "2026-01-01T00:00:00.000Z",
      error: "超时",
    });
    expect(pipeline?.kind).toBe("expanding-full-body");
    expect(pipeline?.error).toBe("超时");
    expect(sanitizeVtonTextTryonJob({ status: "running" })).toBeUndefined();
  });
});
