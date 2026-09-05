import { describe, expect, it } from "vitest";

import {
  computeMinimaxTimingBreakdown,
  mergeMinimaxVendorSnapshot,
  resolveMinimaxLogTiming,
  synthesizeMinimaxTimingTraceFromSummary,
} from "@/lib/gateway/log-minimax-timing";

describe("log-minimax-timing", () => {
  it("synthesizes breakdown from terminal task in resultSummary", () => {
    const submittedAt = new Date("2026-09-03T14:29:32.708Z");
    const completedAt = new Date("2026-09-03T14:39:25.000Z");
    const resultSummary = {
      task: {
        status: "succeeded",
        created_at: 1788445777,
        updated_at: 1788446323,
      },
    };

    const trace = synthesizeMinimaxTimingTraceFromSummary({
      resultSummary,
      submittedAtMs: submittedAt.getTime(),
      completedAtMs: completedAt.getTime(),
    });
    expect(trace?.vendorCreatedAtMs).toBe(1788445777000);
    expect(trace?.vendorUpdatedAtMs).toBe(1788446323000);

    const breakdown = computeMinimaxTimingBreakdown({
      trace: trace!,
      submittedAtMs: submittedAt.getTime(),
      completedAtMs: completedAt.getTime(),
    });
    expect(breakdown.queueMs).toBeGreaterThanOrEqual(4000);
    expect(breakdown.queueMs).toBeLessThan(8000);
    expect(breakdown.generateMs).toBe(546_000);
    expect(breakdown.pollDelayMs).toBeGreaterThan(0);

    const resolved = resolveMinimaxLogTiming({
      providerKind: "MINIMAX",
      requestKind: "VIDEO",
      submittedAt,
      completedAt,
      resultSummary,
    });
    expect(resolved?.generateMs).toBe(546_000);
    expect(resolved?.queueMs).toBeGreaterThan(0);
  });

  it("mergeMinimaxVendorSnapshot keeps _gateway trace while updating task", () => {
    const merged = mergeMinimaxVendorSnapshot(
      {
        _gateway: { minimaxTiming: { lastStatus: "running" } },
        task: { status: "running", created_at: 100 },
      },
      { task: { status: "running", created_at: 100, updated_at: 200 } },
      { status: "running", created_at: 100, updated_at: 200 },
    );
    expect(merged._gateway).toEqual({ minimaxTiming: { lastStatus: "running" } });
    expect((merged.task as { updated_at: number }).updated_at).toBe(200);
  });
});
