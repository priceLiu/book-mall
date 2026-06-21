import { describe, expect, it } from "vitest";

import {
  computeVolcengineTimingBreakdown,
  isVolcengineGatewayPollStalled,
  isVolcenginePollLagCritical,
  isVolcengineQueuedStale,
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

    expect(breakdown.queueMs).toBe(0);
    expect(breakdown.generateMs).toBe(400_000);
    expect(breakdown.pollDelayMs).toBe(3_000);
    expect(breakdown.pollDelayOverLimit).toBe(false);
  });

  it("flags poll delay over 10s on terminal log", () => {
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

  it("in-flight running splits generate vs vendor-stale poll lag when updated_at frozen", () => {
    const submittedAtMs = 1_000_000;
    const genStartMs = 1_000_000 + 3_000;
    const firstPollMs = genStartMs + 5_000;
    const nowMs = 1_000_000 + 68_000;

    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: firstPollMs,
    });
    const traceFrozen = mergeVolcengineTimingTrace(trace, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: nowMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace: traceFrozen,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });

    expect(breakdown.queueMs).toBe(3_000);
    expect(breakdown.generateMs).toBe(0);
    expect(breakdown.pollDelayMs).toBe(65_000);
    expect(breakdown.queueMs! + breakdown.generateMs! + breakdown.pollDelayMs!).toBe(
      nowMs - submittedAtMs,
    );
  });

  it("does not treat poll lag critical while vendor still running", () => {
    const submittedAtMs = 1_000_000;
    const genStartMs = 1_000_000 + 3_000;
    const nowMs = 1_000_000 + 68_000;

    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: nowMs,
    });

    expect(isVolcenginePollLagCritical(trace, nowMs)).toBe(false);
  });

  it("does not flag queued stale before threshold", () => {
    const vendorUpdatedAtMs = 1_000_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "queued",
      raw: { updated_at: vendorUpdatedAtMs / 1000 },
      polledAtMs: vendorUpdatedAtMs + 60_000,
    });
    expect(isVolcengineQueuedStale(trace, vendorUpdatedAtMs + 60_000)).toBe(false);
  });

  it("flags gateway poll stall when vendor updated_at frozen and poll gap exceeded", () => {
    const genStartMs = 1_000_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: genStartMs + 5_000,
    });
    const frozen = mergeVolcengineTimingTrace(trace, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: genStartMs + 810_000,
    });
    const nowMs = genStartMs + 810_000;
    const lastPolledAt = new Date(genStartMs + 600_000);
    expect(
      isVolcengineGatewayPollStalled(frozen, lastPolledAt, nowMs),
    ).toBe(true);
    expect(
      isVolcengineGatewayPollStalled(
        frozen,
        new Date(nowMs - 30_000),
        nowMs,
      ),
    ).toBe(false);
  });
});
