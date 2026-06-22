import { describe, expect, it } from "vitest";

import {
  isLogInProgress,
  resolveLogDisplayDurationMs,
} from "../../../gateway-web/lib/gateway-log-params";

describe("resolveLogDisplayDurationMs", () => {
  const submittedAt = "2026-06-22T03:00:00.000Z";

  it("sums phase timings when live clock unavailable (dev hydration gap)", () => {
    expect(
      resolveLogDisplayDurationMs({
        durationMs: null,
        submittedAt,
        completedAt: null,
        isInProgress: true,
        nowMs: null,
        queueMs: 1_000,
        generateMs: 183_000,
        pollDelayMs: 2_000,
      }),
    ).toBe(186_000);
  });

  it("prefers live total when present", () => {
    expect(
      resolveLogDisplayDurationMs({
        durationMs: null,
        submittedAt,
        completedAt: null,
        isInProgress: true,
        nowMs: Date.parse(submittedAt) + 50_000,
        queueMs: 1_000,
        generateMs: 40_000,
        liveTotalMs: 46_000,
      }),
    ).toBe(46_000);
  });

  it("ignores stale DB durationMs while in progress (wall clock ticks)", () => {
    expect(
      resolveLogDisplayDurationMs({
        durationMs: 186_000,
        submittedAt,
        completedAt: null,
        isInProgress: true,
        nowMs: Date.parse(submittedAt) + 190_000,
        queueMs: 1_000,
        generateMs: 183_000,
        pollDelayMs: 2_000,
      }),
    ).toBe(190_000);
  });

  it("isLogInProgress is case-insensitive", () => {
    expect(isLogInProgress("running")).toBe(true);
    expect(isLogInProgress("RUNNING")).toBe(true);
  });
});
