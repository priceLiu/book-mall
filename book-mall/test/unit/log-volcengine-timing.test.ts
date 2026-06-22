import { describe, expect, it } from "vitest";

import {
  computeVolcengineTimingBreakdown,
  isVolcengineVendorStuck,
  isVolcenginePollLagCritical,
  isVolcengineQueuedStale,
  mergeVolcengineTimingTrace,
  resolveVolcengineLogTiming,
  VOLCENGINE_VENDOR_STALE_RELEASE_MS,
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
    expect(breakdown.vendorPostProcessMs).toBe(3_000);
    expect(breakdown.pollDelayMs).toBe(0);
    expect(breakdown.pollDelayOverLimit).toBe(false);
  });

  it("flags poll delay over 10s on terminal log (true poll lag, not post-process)", () => {
    const submittedAtMs = 0;
    const vendorUpdatedAtMs = 100_000;
    const firstSucceededAtMs = 110_000;
    const completedAtMs = 125_000;
    let trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: { created_at: 0, updated_at: vendorUpdatedAtMs / 1000 },
      polledAtMs: vendorUpdatedAtMs + 1_000,
    });
    trace = mergeVolcengineTimingTrace(trace, {
      status: "succeeded",
      raw: {
        created_at: 0,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: firstSucceededAtMs,
    });
    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs,
    });
    expect(breakdown.vendorPostProcessMs).toBe(10_000);
    expect(breakdown.pollDelayMs).toBe(15_000);
    expect(breakdown.pollDelayOverLimit).toBe(true);
  });

  it("Seedance: long post-process after updated_at jump, poll lag near zero", () => {
    const submittedAtMs = 1_000_000;
    const createdAtMs = submittedAtMs + 7_000;
    const vendorUpdatedAtMs = createdAtMs + 484_000;
    const firstSucceededAtMs = vendorUpdatedAtMs + 995_000;
    const completedAtMs = firstSucceededAtMs + 1_000;

    let trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: createdAtMs / 1000,
        updated_at: createdAtMs / 1000,
      },
      polledAtMs: createdAtMs + 12_000,
    });
    trace = mergeVolcengineTimingTrace(trace, {
      status: "running",
      raw: {
        created_at: createdAtMs / 1000,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: vendorUpdatedAtMs + 2_000,
    });
    trace = mergeVolcengineTimingTrace(trace, {
      status: "succeeded",
      raw: {
        created_at: createdAtMs / 1000,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: firstSucceededAtMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs,
    });

    expect(breakdown.generateMs).toBe(484_000);
    expect(breakdown.vendorPostProcessMs).toBe(995_000);
    expect(breakdown.pollDelayMs).toBe(1_000);
    expect(breakdown.pollDelayOverLimit).toBe(false);
  });

  it("legacy terminal log without firstSucceededPolledAtMs falls back to lastPolledAtMs", () => {
    const submittedAtMs = 0;
    const vendorUpdatedAtMs = 100_000;
    const completedAtMs = 115_000;
    const trace: import("@/lib/gateway/log-volcengine-timing").VolcengineTimingTrace =
      {
        kind: "volcengine_timing",
        lastStatus: "succeeded",
        vendorCreatedAtMs: 0,
        vendorUpdatedAtMs,
        lastPolledAtMs: completedAtMs - 1_000,
      };
    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs,
    });
    expect(breakdown.vendorPostProcessMs).toBe(14_000);
    expect(breakdown.pollDelayMs).toBe(1_000);
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

  it("in-flight running: Generate tracks wall-clock, Poll Δ = our poll lag (fresh poll → 0)", () => {
    // 火山生成中 updated_at 恒等于 created_at：Generate 必须走墙钟（仍在生成，持续增长），
    // Poll Δ 只反映我方轮询延迟。刚 poll 过 → Poll Δ ≈ 0，绝不能把生成时间写进 Poll Δ。
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
    const traceFresh = mergeVolcengineTimingTrace(trace, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: nowMs, // 刚刚成功 poll
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace: traceFresh,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });

    expect(breakdown.queueMs).toBe(3_000);
    expect(breakdown.generateMs).toBe(65_000); // 墙钟生成时长
    expect(breakdown.pollDelayMs).toBe(0); // 刚 poll 过，无延迟
    expect(breakdown.pollDelayOverLimit).toBe(false);
  });

  it("in-flight running: Poll Δ grows when our poll loop falls behind (stall signal)", () => {
    // 单次 poll 后我方久未再 poll：Generate 仍走墙钟，Poll Δ = now − 最近一次 poll。
    const submittedAtMs = 1_000_000;
    const genStartMs = 1_000_000 + 3_000;
    const lastPollMs = genStartMs + 5_000;
    const nowMs = 1_000_000 + 68_000;

    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: lastPollMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });

    expect(breakdown.queueMs).toBe(3_000);
    expect(breakdown.generateMs).toBe(65_000); // 墙钟生成时长
    expect(breakdown.pollDelayMs).toBe(60_000); // now − lastPolled
  });

  it("terminal failed without succeeded does not bucket into postproc", () => {
    const submittedAtMs = 1_000_000;
    const genStartMs = 1_000_000 + 3_000;
    const vendorFailedAtMs = genStartMs + 300_000;
    const completedAtMs = genStartMs + 3_000_000;

    let trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: genStartMs + 5_000,
    });
    trace = mergeVolcengineTimingTrace(trace, {
      status: "failed",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: vendorFailedAtMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs,
    });

    expect(breakdown.generateMs).toBe(300_000);
    expect(breakdown.vendorPostProcessMs).toBeNull();
    expect(breakdown.pollDelayMs).toBe(2_700_000);
  });

  it("terminal still splits generate / post-process / poll via vendor updated_at", () => {
    // 终态：Generate = updated_at − created_at；PostProc = firstSucceeded − updated_at；Poll = completed − firstSucceeded
    const submittedAtMs = 1_000_000;
    const genStartMs = 1_000_000;
    const vendorUpdatedAtMs = genStartMs + 200_000;
    const completedAtMs = genStartMs + 203_000;

    const trace = mergeVolcengineTimingTrace(null, {
      status: "succeeded",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: completedAtMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs,
    });

    expect(breakdown.generateMs).toBe(200_000);
    expect(breakdown.vendorPostProcessMs).toBe(3_000);
    expect(breakdown.pollDelayMs).toBe(0);
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

  it("detects vendor updated_at frozen for background promotion threshold", () => {
    const genStartMs = 1_000_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: genStartMs + 5_000,
    });
    // 厂商进度冻结 ≥ 阈值 → 满足后台化条件（不再 FAILED）
    const stuckNow = genStartMs + VOLCENGINE_VENDOR_STALE_RELEASE_MS + 1_000;
    expect(isVolcengineVendorStuck(trace, stuckNow)).toBe(true);
    // 停更时长低于阈值 → 不触发后台化
    const okNow = genStartMs + VOLCENGINE_VENDOR_STALE_RELEASE_MS / 2;
    expect(isVolcengineVendorStuck(trace, okNow)).toBe(false);
  });

  it("vendor-stale also detected when poll loop stops (diagnostic)", () => {
    // loop 挂掉后不再 poll：vendor 进度冻结时长仍随墙钟增长。
    const genStartMs = 1_000_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: { created_at: genStartMs / 1000, updated_at: genStartMs / 1000 },
      polledAtMs: genStartMs + 5_000, // 仅一次 poll，之后 loop 死
    });
    const nowMs = genStartMs + VOLCENGINE_VENDOR_STALE_RELEASE_MS + 120_000;
    expect(isVolcengineVendorStuck(trace, nowMs)).toBe(true);
  });
});
