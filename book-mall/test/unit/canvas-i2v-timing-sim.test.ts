/**
 * 画布图生视频并发压测 · 日志 4 时间正确性（纯函数，可离线运行）
 *
 * 校验 Gateway 火山视频日志的四个时间在「10 路并发、各自轮询时间线」下都正确：
 *   - 总耗时 durationMs ≈ 排队 + 生成 + 轮询延迟
 *   - 排队 queueMs   = 厂商 created_at − Gateway submittedAt
 *   - 生成 generateMs = 厂商 updated_at − created_at（厂商时间轴；停更即冻结，不随墙钟涨）
 *   - 后处理 vendorPostProcessMs = 首次 succeeded − 厂商 updated_at
 *   - 轮询延迟 pollDelayMs = Gateway completedAt − 首次 succeeded
 *
 * 配套真实在线压测见 /dev/canvas/i2v-load-test（Seedance 2.0、10 路）。
 */
import { describe, it, expect } from "vitest";

import {
  computeVolcengineTimingBreakdown,
  mergeVolcengineTimingTrace,
  type VolcengineTimingTrace,
} from "@/lib/gateway/log-volcengine-timing";

const SEC = 1000;
const BASE = 1_700_000_000_000;

type PollEvent = {
  /** 轮询发生时的墙钟（ms） */
  atMs: number;
  status: string;
  /** 厂商 created_at（ms，可空表示该次未返回） */
  createdAtMs?: number;
  /** 厂商 updated_at（ms） */
  updatedAtMs?: number;
};

/** 把一条任务的轮询事件回放成最终 trace */
function replay(events: PollEvent[]): VolcengineTimingTrace {
  let trace: VolcengineTimingTrace | null = null;
  for (const e of events) {
    const raw: Record<string, unknown> = {};
    if (e.createdAtMs != null) raw.created_at = Math.round(e.createdAtMs / 1000);
    if (e.updatedAtMs != null) raw.updated_at = Math.round(e.updatedAtMs / 1000);
    trace = mergeVolcengineTimingTrace(trace, {
      status: e.status,
      raw,
      polledAtMs: e.atMs,
    });
  }
  return trace!;
}

/**
 * 生成一条「正常成功」的 i2v 任务时间线。
 * @param offset 相对 BASE 的提交时刻（模拟 10 路错峰被出队）
 * @param queueSec 厂商排队（created_at − submitted）
 * @param genSec   厂商生成（updated_at − created_at）
 * @param pollLagSec 首次 succeeded 前的后处理/收口延迟（completed − updated_at，success 与 updated 同 poll 时全归 postProcess）
 */
function makeJob(
  offset: number,
  queueSec: number,
  genSec: number,
  pollLagSec: number,
) {
  const submittedAtMs = BASE + offset;
  const createdAtMs = submittedAtMs + queueSec * SEC;
  const finalUpdatedAtMs = createdAtMs + genSec * SEC;
  const completedAtMs = finalUpdatedAtMs + pollLagSec * SEC;

  const events: PollEvent[] = [];
  // 第一次：厂商已 queued，返回 created_at
  events.push({
    atMs: createdAtMs + 1 * SEC,
    status: "queued",
    createdAtMs,
    updatedAtMs: createdAtMs,
  });
  // 生成过程中：updated_at 每 5s 推进一次
  for (let t = createdAtMs + 5 * SEC; t < finalUpdatedAtMs; t += 5 * SEC) {
    events.push({ atMs: t + 1 * SEC, status: "running", createdAtMs, updatedAtMs: t });
  }
  // 成功：updated_at = finalUpdated
  events.push({
    atMs: completedAtMs,
    status: "succeeded",
    createdAtMs,
    updatedAtMs: finalUpdatedAtMs,
  });

  return {
    submittedAtMs,
    completedAtMs,
    expected: {
      queueMs: queueSec * SEC,
      generateMs: genSec * SEC,
      vendorPostProcessMs: pollLagSec * SEC,
      pollDelayMs: 0,
      durationMs: (queueSec + genSec + pollLagSec) * SEC,
    },
    trace: replay(events),
  };
}

describe("i2v 并发压测 · 日志 4 时间正确性", () => {
  it("单条任务：排队/生成/轮询延迟与总耗时拆分正确", () => {
    const job = makeJob(0, 3, 18, 1.5);
    const b = computeVolcengineTimingBreakdown({
      trace: job.trace,
      submittedAtMs: job.submittedAtMs,
      completedAtMs: job.completedAtMs,
    });
    expect(b.queueMs).toBe(job.expected.queueMs);
    expect(b.generateMs).toBe(job.expected.generateMs);
    expect(b.vendorPostProcessMs).toBe(job.expected.vendorPostProcessMs);
    expect(b.pollDelayMs).toBe(job.expected.pollDelayMs);
    expect(b.pollDelayOverLimit).toBe(false);
    expect(
      b.queueMs! +
        b.generateMs! +
        (b.vendorPostProcessMs ?? 0) +
        (b.pollDelayMs ?? 0),
    ).toBe(job.expected.durationMs);
  });

  it("10 路并发：各自错峰提交，四个时间逐条正确且自洽", () => {
    // 模拟 maxConcurrency=2 时的错峰出队：每隔 ~3s 出队两条
    const jobs = Array.from({ length: 10 }, (_, i) => {
      const wave = Math.floor(i / 2); // 0..4
      const offset = wave * 3 * SEC; // 每波相隔 3s
      const queueSec = 2 + (i % 3); // 2~4s 排队
      const genSec = 14 + (i % 4); // 14~17s 生成（15s 视频量级）
      const pollLagSec = 0.5 + (i % 2) * 0.5; // 0.5~1s 轮询延迟
      return makeJob(offset, queueSec, genSec, pollLagSec);
    });

    for (const [i, job] of jobs.entries()) {
      const b = computeVolcengineTimingBreakdown({
        trace: job.trace,
        submittedAtMs: job.submittedAtMs,
        completedAtMs: job.completedAtMs,
      });
      expect(b.queueMs, `job#${i} queue`).toBe(job.expected.queueMs);
      expect(b.generateMs, `job#${i} generate`).toBe(job.expected.generateMs);
      expect(b.vendorPostProcessMs, `job#${i} postProcess`).toBe(
        job.expected.vendorPostProcessMs,
      );
      expect(b.pollDelayMs, `job#${i} pollDelay`).toBe(job.expected.pollDelayMs);
      expect(
        b.queueMs! +
          b.generateMs! +
          (b.vendorPostProcessMs ?? 0) +
          (b.pollDelayMs ?? 0),
        `job#${i} sum==duration`,
      ).toBe(job.expected.durationMs);
      expect(b.pollDelayOverLimit, `job#${i} pollDelay over limit`).toBe(false);
    }
  });

  it("进行中：Generate 走墙钟持续增长，Poll Δ = 我方轮询延迟（不再把生成时间写进 Poll）", () => {
    // 火山生成中 updated_at 不前进：Generate 必须随墙钟增长，Poll Δ 只反映我方轮询间隔。
    const submittedAtMs = BASE;
    const createdAtMs = BASE + 3 * SEC;
    const lastPollAtMs = createdAtMs + 18 * SEC; // 最近一次成功 poll
    const trace = replay([
      { atMs: createdAtMs + 1 * SEC, status: "queued", createdAtMs, updatedAtMs: createdAtMs },
      { atMs: createdAtMs + 6 * SEC, status: "running", createdAtMs, updatedAtMs: createdAtMs },
      { atMs: createdAtMs + 13 * SEC, status: "running", createdAtMs, updatedAtMs: createdAtMs },
      { atMs: lastPollAtMs, status: "running", createdAtMs, updatedAtMs: createdAtMs },
    ]);

    const nowMs = createdAtMs + 30 * SEC;
    const b = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });

    expect(b.queueMs).toBe(3 * SEC);
    // 生成走墙钟：now − genStart = 30s（不再冻结在 0）
    expect(b.generateMs).toBe(30 * SEC);
    // Poll Δ = now − 最近一次 poll = 30 − 18 = 12s（我方轮询延迟）
    expect(b.pollDelayMs).toBe(12 * SEC);
    // 12s < 轮询中断阈值（2min），不算卡死
    expect(b.pollDelayOverLimit).toBe(false);
  });

  it("排队阶段（厂商未开始生成）：只计排队，不计生成", () => {
    const submittedAtMs = BASE;
    const createdAtMs = BASE + 2 * SEC;
    const trace = replay([
      { atMs: BASE + 3 * SEC, status: "queued", createdAtMs, updatedAtMs: createdAtMs },
    ]);
    const nowMs = BASE + 8 * SEC;
    const b = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs,
      completedAtMs: null,
      nowMs,
    });
    expect(b.queueMs).toBe(2 * SEC);
    // 纯 queued（未 running）：不计生成
    expect(b.generateMs).toBeNull();
  });
});
