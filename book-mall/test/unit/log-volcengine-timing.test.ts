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

  it("terminal still splits generate vs poll delay via vendor updated_at", () => {
    // 终态拆分逻辑不变：Generate = updated_at − created_at，Poll Δ = completed − updated_at。
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
    expect(breakdown.pollDelayMs).toBe(3_000);
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
    // 厂商停更时长 ≥ 阈值 → 卡死
    const stuckNow = genStartMs + VOLCENGINE_VENDOR_STALE_RELEASE_MS + 1_000;
    expect(isVolcengineVendorStuck(trace, stuckNow)).toBe(true);
    // 停更时长低于阈值 → 不判卡死（取阈值的一半，避免与阈值边界耦合）
    const okNow = genStartMs + VOLCENGINE_VENDOR_STALE_RELEASE_MS / 2;
    expect(isVolcengineVendorStuck(trace, okNow)).toBe(false);
  });

  it("vendor-stale release also catches a dead poll loop (image 7), regardless of last poll", () => {
    // loop 挂掉后不再 poll：厂商停更时长照常随墙钟增长，超阈值即可收口释放槽位。
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
