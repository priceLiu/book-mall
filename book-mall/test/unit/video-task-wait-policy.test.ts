import { describe, expect, it } from "vitest";

import {
  VIDEO_BACKGROUND_UI_MS,
  buildVideoBackgroundWaitWhere,
  isVideoBackgroundWaitAge,
  resolveVideoGeneratingLabel,
} from "@/lib/gateway/video-task-wait-policy";

describe("video-task-wait-policy", () => {
  const now = Date.parse("2026-06-22T12:00:00.000Z");

  it("isVideoBackgroundWaitAge respects 10min threshold", () => {
    const submitted = new Date(now - VIDEO_BACKGROUND_UI_MS - 1);
    expect(isVideoBackgroundWaitAge(submitted, submitted, now)).toBe(true);
    expect(
      isVideoBackgroundWaitAge(
        new Date(now - VIDEO_BACKGROUND_UI_MS + 60_000),
        new Date(now - VIDEO_BACKGROUND_UI_MS + 60_000),
        now,
      ),
    ).toBe(false);
  });

  it("buildVideoBackgroundWaitWhere targets in-flight logs older than cutoff", () => {
    const where = buildVideoBackgroundWaitWhere(VIDEO_BACKGROUND_UI_MS, now);
    expect(where).toEqual({
      status: { in: ["PENDING", "RUNNING"] },
      submittedAt: { lte: new Date(now - VIDEO_BACKGROUND_UI_MS) },
    });
  });

  it("resolveVideoGeneratingLabel switches to background label", () => {
    expect(resolveVideoGeneratingLabel(false, false)).toBe("视频生成中…");
    expect(resolveVideoGeneratingLabel(true, false)).toBe("排队中…");
    expect(resolveVideoGeneratingLabel(false, true)).toBe("后台生成中…");
  });
});
