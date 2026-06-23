import { describe, expect, it } from "vitest";

import {
  CANVAS_POLL_STALE_BACKOFF_MS,
  nextPollIntervalMs,
} from "@/lib/canvas/poll-interval";

describe("nextPollIntervalMs 自适应轮询间隔", () => {
  it("stale 优先：无论在飞多少都退避到 15s", () => {
    expect(nextPollIntervalMs(0, true)).toBe(CANVAS_POLL_STALE_BACKOFF_MS);
    expect(nextPollIntervalMs(1, true)).toBe(CANVAS_POLL_STALE_BACKOFF_MS);
    expect(nextPollIntervalMs(10, true)).toBe(CANVAS_POLL_STALE_BACKOFF_MS);
  });

  it("无在飞任务返回 0（暂停 DB 轮询）", () => {
    expect(nextPollIntervalMs(0, false)).toBe(0);
    expect(nextPollIntervalMs(-1, false)).toBe(0);
  });

  it("1 条在飞 → 3s", () => {
    expect(nextPollIntervalMs(1, false)).toBe(3_000);
  });

  it("2~3 条在飞 → 5s", () => {
    expect(nextPollIntervalMs(2, false)).toBe(5_000);
    expect(nextPollIntervalMs(3, false)).toBe(5_000);
  });

  it(">3 条在飞 → 8s 退避", () => {
    expect(nextPollIntervalMs(4, false)).toBe(8_000);
    expect(nextPollIntervalMs(20, false)).toBe(8_000);
  });

  it("间隔随并发单调不减（无 stale 时）", () => {
    const seq = [1, 2, 3, 4, 8].map((n) => nextPollIntervalMs(n, false));
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1]!);
    }
  });
});
