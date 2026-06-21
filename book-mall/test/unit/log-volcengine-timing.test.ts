import { describe, expect, it } from "vitest";

import {
  computeVolcengineTimingBreakdown,
  isVolcengineVendorUpdatedStale,
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

  it("in-flight generateMs follows vendor updated_at, not wall clock", () => {
    const submittedAtMs = 1_000_000;
    const firstRunningAtMs = 1_000_000 + 60_000;
    const vendorUpdatedAtMs = 1_000_000 + 300_000;
    const nowMs = 1_000_000 + 600_000;

    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: submittedAtMs / 1000,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: firstRunningAtMs,
    });
    const staleTrace = mergeVolcengineTimingTrace(trace, {
      status: "running",
      raw: { updated_at: vendorUpdatedAtMs / 1000 },
      polledAtMs: nowMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace: staleTrace,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });

    expect(breakdown.generateMs).toBe(240_000);
    expect(breakdown.generateMs).not.toBe(nowMs - firstRunningAtMs);
  });

  it("detects vendor updated_at stall after threshold", () => {
    const vendorUpdatedAtMs = 1_000_000;
    const firstPoll = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: { updated_at: vendorUpdatedAtMs / 1000 },
      polledAtMs: vendorUpdatedAtMs,
    });
    const secondPoll = mergeVolcengineTimingTrace(firstPoll, {
      status: "running",
      raw: { updated_at: vendorUpdatedAtMs / 1000 },
      polledAtMs: vendorUpdatedAtMs + 60_000,
    });

    expect(
      isVolcengineVendorUpdatedStale(
        secondPoll,
        vendorUpdatedAtMs + 60_000,
        10 * 60 * 1000,
      ),
    ).toBe(false);
    expect(
      isVolcengineVendorUpdatedStale(
        secondPoll,
        vendorUpdatedAtMs + 11 * 60 * 1000,
        10 * 60 * 1000,
      ),
    ).toBe(true);
  });
});
