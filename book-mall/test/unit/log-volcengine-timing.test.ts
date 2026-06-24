import { describe, expect, it } from "vitest";

import {
  buildVolcengineTerminalFinalizeMetrics,
  computeVolcengineTimingBreakdown,
  isVolcengineVendorStuck,
  isVolcenginePollLagCritical,
  isVolcengineQueuedStale,
  mergeVolcengineTimingTrace,
  resolveVendorNativeTimingForLogRow,
  resolveVolcengineLogTiming,
  resolveVolcengineTerminalCompletedAtMs,
  VOLCENGINE_VENDOR_STALE_RELEASE_MS,
} from "@/lib/gateway/log-volcengine-timing";
import type { VolcengineTimingTrace } from "@/lib/gateway/log-volcengine-timing";

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

  it("in-flight running: Seedance frozen updated → Generate ticks wall-clock from genStart; Poll Δ = poll lag", () => {
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
      polledAtMs: nowMs,
    });

    const breakdown = computeVolcengineTimingBreakdown({
      trace: traceFresh,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });

    expect(breakdown.queueMs).toBe(3_000);
    // genStart=submitted+3s, now=submitted+68s → 生成墙钟 65s（GPU 真值终态回填）
    expect(breakdown.generateMs).toBe(65_000);
    expect(breakdown.pollDelayMs).toBe(0);
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
    // Seedance updated 冻结：生成仍按墙钟累计（now−genStart=65s），不因 poll 滞后而显示 —
    expect(breakdown.generateMs).toBe(65_000);
    expect(breakdown.pollDelayMs).toBe(60_000);
  });

  it("in-flight running: generate freezes after vendor updated jump; postproc ticks", () => {
    const submittedAtMs = 1_000_000;
    const createdMs = submittedAtMs + 5_000;
    const updatedMs = createdMs + 233_000;
    const nowMs = updatedMs + 120_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: createdMs / 1000,
        updated_at: updatedMs / 1000,
      },
      polledAtMs: nowMs - 5_000,
    });
    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });
    expect(breakdown.generateMs).toBe(233_000);
    expect(breakdown.vendorPostProcessMs).toBe(120_000);
    expect(breakdown.pollDelayMs).toBe(5_000);
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

  it("resolveVendorNativeTimingForLogRow: Seedance GPU 进行中 updated 未跳变 → null（不计秒）", () => {
    const createdMs = 1_000_000;
    const nowMs = createdMs + 1_084_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: createdMs / 1000,
        updated_at: createdMs / 1000,
      },
      polledAtMs: nowMs - 950_000,
    });
    const row = resolveVendorNativeTimingForLogRow({
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      vendorDurationMs: null,
      resultSummary: { _gateway: { volcengineTiming: trace } },
      nowMs,
    });
    expect(row.vendorNativeGenerateMs).toBeNull();
    expect(row.vendorNativeDurationMs).toBeNull();
  });

  it("resolveVendorNativeTimingForLogRow uses volcengine trace span", () => {
    const createdMs = 1_000_000;
    const updatedMs = 1_000_000 + 120_000;
    const trace = mergeVolcengineTimingTrace(null, {
      status: "succeeded",
      raw: {
        created_at: createdMs / 1000,
        updated_at: updatedMs / 1000,
      },
      polledAtMs: updatedMs + 1_000,
    });
    const row = resolveVendorNativeTimingForLogRow({
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      vendorDurationMs: null,
      resultSummary: { _gateway: { volcengineTiming: trace } },
    });
    expect(row.vendorNativeDurationMs).toBe(120_000);
    expect(row.vendorNativeGenerateMs).toBe(120_000);
  });

  it("resolveVendorNativeTimingForLogRow prefers vendorDurationMs for KIE", () => {
    const row = resolveVendorNativeTimingForLogRow({
      providerKind: "KIE",
      requestKind: "VIDEO",
      vendorDurationMs: 88_000,
      resultSummary: null,
    });
    expect(row.vendorNativeDurationMs).toBe(88_000);
    expect(row.vendorNativeGenerateMs).toBe(88_000);
  });

  it("terminal finalize: durationMs equals phase sum, not late recover wall clock", () => {
    const submittedAtMs = 1_000_000;
    const genStartMs = submittedAtMs + 3_000;
    const vendorUpdatedAtMs = genStartMs + 335_000;
    const lateRecoverAtMs = submittedAtMs + 759_000;

    let trace = mergeVolcengineTimingTrace(null, {
      status: "running",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: genStartMs / 1000,
      },
      polledAtMs: genStartMs + 5_000,
    });
    trace = mergeVolcengineTimingTrace(trace, {
      status: "succeeded",
      raw: {
        created_at: genStartMs / 1000,
        updated_at: vendorUpdatedAtMs / 1000,
      },
      polledAtMs: lateRecoverAtMs,
    });

    const metrics = buildVolcengineTerminalFinalizeMetrics({
      trace,
      status: "SUCCEEDED",
      submittedAt: new Date(submittedAtMs),
      resultSummaryBase: {},
      fallbackNowMs: lateRecoverAtMs,
    });

    expect(metrics.breakdown.generateMs).toBe(335_000);
    expect(metrics.breakdown.vendorPostProcessMs).toBe(421_000);
    expect(metrics.breakdown.pollDelayMs).toBe(0);
    expect(metrics.durationMs).toBe(759_000);
    expect(metrics.completedAtMs).toBe(lateRecoverAtMs);
  });

  it("resolveVolcengineLogTiming freezes stored breakdown for terminal logs", () => {
    const submittedAt = new Date(1_000_000);
    const completedAt = new Date(1_403_000);
    const stored = {
      queueMs: 0,
      generateMs: 400_000,
      vendorPostProcessMs: 3_000,
      pollDelayMs: 0,
      pollDelayOverLimit: false,
    };
    const resultSummary = {
      _gateway: {
        volcengineTiming: { kind: "volcengine_timing", lastStatus: "succeeded" },
        timingBreakdown: stored,
      },
    };
    expect(
      resolveVolcengineLogTiming({
        providerKind: "VOLCENGINE",
        requestKind: "VIDEO",
        submittedAt,
        completedAt,
        resultSummary,
        nowMs: 9_999_999_999,
      }),
    ).toEqual(stored);
  });
});

describe("resolveVolcengineTerminalCompletedAtMs（D·完成时刻锚点回归）", () => {
  const submittedAtMs = 1_000_000;
  const base: VolcengineTimingTrace = { kind: "volcengine_timing" };

  it("SUCCEEDED：优先用 firstSucceededPolledAtMs（厂商完成观测时刻），而非检测时的 now", () => {
    const firstSucc = submittedAtMs + 264_000;
    const lateNow = submittedAtMs + 888_000; // 检测滞后到 888s
    const got = resolveVolcengineTerminalCompletedAtMs({
      trace: { ...base, firstSucceededPolledAtMs: firstSucc, lastStatus: "succeeded" },
      status: "SUCCEEDED",
      submittedAtMs,
      fallbackNowMs: lateNow,
    });
    expect(got).toBe(firstSucc);
  });

  it("SUCCEEDED：无 succeeded 观测锚点时回退 vendorUpdatedAtMs，仍不灌入检测滞后", () => {
    const vendorUpdated = submittedAtMs + 300_000;
    const lateNow = submittedAtMs + 900_000;
    // lastStatus 非 succeeded（未 poll 到终态）→ firstSucc 解析为 null → 回退 vendorUpdatedAtMs
    const got = resolveVolcengineTerminalCompletedAtMs({
      trace: { ...base, vendorUpdatedAtMs: vendorUpdated, lastStatus: "running" },
      status: "SUCCEEDED",
      submittedAtMs,
      fallbackNowMs: lateNow,
    });
    expect(got).toBe(vendorUpdated);
  });

  it("完成时刻不会早于提交时刻（下限夹取 submittedAtMs）", () => {
    const got = resolveVolcengineTerminalCompletedAtMs({
      trace: { ...base, firstSucceededPolledAtMs: submittedAtMs - 50_000, lastStatus: "succeeded" },
      status: "SUCCEEDED",
      submittedAtMs,
      fallbackNowMs: submittedAtMs + 10_000,
    });
    expect(got).toBe(submittedAtMs);
  });

  it("FAILED：优先 firstFailedPolledAtMs / vendorUpdatedAtMs，否则回退 now", () => {
    const vendorUpdated = submittedAtMs + 120_000;
    const got = resolveVolcengineTerminalCompletedAtMs({
      trace: { ...base, vendorUpdatedAtMs: vendorUpdated, lastStatus: "failed" },
      status: "FAILED",
      submittedAtMs,
      fallbackNowMs: submittedAtMs + 600_000,
    });
    expect(got).toBe(vendorUpdated);

    const noAnchor = resolveVolcengineTerminalCompletedAtMs({
      trace: { ...base, lastStatus: "failed" },
      status: "FAILED",
      submittedAtMs,
      fallbackNowMs: submittedAtMs + 5_000,
    });
    expect(noAnchor).toBe(submittedAtMs + 5_000);
  });
});
