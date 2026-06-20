import { describe, expect, it } from "vitest";

import {
  computeVolcengineTimingBreakdown,
  mergeVolcengineTimingTrace,
  resolveVolcengineLogTiming,
} from "@/lib/gateway/log-volcengine-timing";

describe("log-volcengine-timing", () => {
  it("splits queue / generate / poll delay on success", () => {
    const submittedAtMs = 1_000_000;
    const firstRunningAtMs = 1_000_000 + 45_000;
    const vendorUpdatedAtMs = 1_000_000 + 400_000;
    const completedAtMs = 1_000_000 + 403_000;

    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: { created_at: submittedAtMs / 1000 },
      polledAtMs: firstRunningAtMs,
    });
    const afterSuccess = mergeVolcengineTimingTrace(trace, {
      status: "succeeded",
      raw: {
        created_at: submittedAtMs / 1000,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: completedAtMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace: afterSuccess,
      submittedAtMs,
      completedAtMs,
    });

    expect(breakdown.queueMs).toBe(45_000);
    expect(breakdown.generateMs).toBe(355_000);
    expect(breakdown.pollDelayMs).toBe(3_000);
    expect(breakdown.pollDelayOverLimit).toBe(false);
  });

  it("flags poll delay over 10s", () => {
    const submittedAtMs = 0;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "succeeded",
      raw: { created_at: 0, updated_at: 100 },
      polledAtMs: 115_000,
    });
    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs: 115_000,
    });
    expect(breakdown.pollDelayMs).toBe(15_000);
    expect(breakdown.pollDelayOverLimit).toBe(true);
  });

  it("resolveVolcengineLogTiming returns null for non-volcengine video", () => {
    expect(
      resolveVolcengineLogTiming({
        providerKind: "KIE",
        requestKind: "VIDEO",
        submittedAt: new Date(),
        completedAt: null,
        resultSummary: null,
      }),
    ).toBeNull();
  });
});
