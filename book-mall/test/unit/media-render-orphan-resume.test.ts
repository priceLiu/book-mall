import { MediaRenderJobStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  MEDIA_RENDER_ORPHAN_RESUME_COOLDOWN_MS,
  MEDIA_RENDER_ORPHAN_RESUME_GRACE_MS,
  MEDIA_RENDER_ORPHAN_RESUME_MAX_PROGRESS,
  shouldResumeOrphanedMediaRenderJob,
} from "@/lib/media/media-render-service";

describe("media render orphan resume", () => {
  const now = Date.UTC(2026, 7, 18, 12, 0, 0);
  const createdAt = new Date(now - MEDIA_RENDER_ORPHAN_RESUME_GRACE_MS - 1_000);

  it("does not resume late ffmpeg-phase jobs (avoid 72%→68% restart)", () => {
    expect(
      shouldResumeOrphanedMediaRenderJob({
        status: MediaRenderJobStatus.RUNNING,
        progress: 72,
        createdAt,
        now,
        isActivelyProcessing: false,
      }),
    ).toBe(false);
  });

  it("resumes early running jobs not tracked in this process", () => {
    expect(
      shouldResumeOrphanedMediaRenderJob({
        status: MediaRenderJobStatus.RUNNING,
        progress: MEDIA_RENDER_ORPHAN_RESUME_MAX_PROGRESS - 1,
        createdAt,
        now,
        isActivelyProcessing: false,
      }),
    ).toBe(true);
  });

  it("does not resume jobs still within grace period", () => {
    expect(
      shouldResumeOrphanedMediaRenderJob({
        status: MediaRenderJobStatus.RUNNING,
        progress: 72,
        createdAt: new Date(now - 5_000),
        now,
        isActivelyProcessing: false,
      }),
    ).toBe(false);
  });

  it("does not resume upload-phase jobs", () => {
    expect(
      shouldResumeOrphanedMediaRenderJob({
        status: MediaRenderJobStatus.RUNNING,
        progress: 92,
        createdAt,
        now,
        isActivelyProcessing: false,
      }),
    ).toBe(false);
  });

  it("does not resume when already processing in this process", () => {
    expect(
      shouldResumeOrphanedMediaRenderJob({
        status: MediaRenderJobStatus.RUNNING,
        progress: 72,
        createdAt,
        now,
        isActivelyProcessing: true,
      }),
    ).toBe(false);
  });

  it("respects resume cooldown", () => {
    expect(
      shouldResumeOrphanedMediaRenderJob({
        status: MediaRenderJobStatus.PENDING,
        progress: 0,
        createdAt,
        now,
        isActivelyProcessing: false,
        lastResumeAttemptAt: now - MEDIA_RENDER_ORPHAN_RESUME_COOLDOWN_MS + 1_000,
      }),
    ).toBe(false);
  });
});
