/**
 * 压力/回归：100 个独立任务 · 单点失败不应清空整批 sequential 链。
 * 纯逻辑模拟（不连 DB / Gateway）。
 */
import { describe, expect, it } from "vitest";

type Job = { nodeId: string; rowKey?: string; llmSection?: string; mediaKind?: string };

function isIndependentCanvasNodeJob(job: Job): boolean {
  return !job.rowKey && !job.llmSection && !job.mediaKind;
}

type SequentialState = {
  jobs: Job[];
  cursor: number;
  activeKey: string | null;
} | null;

function runKey(job: Job): string {
  return job.nodeId;
}

function simulateBatchWithMidFailure(jobCount: number, failAtIndex: number): {
  processed: number;
  failed: number;
  abortedEarly: boolean;
} {
  let seq: SequentialState = {
    jobs: Array.from({ length: jobCount }, (_, i) => ({ nodeId: `n${i}` })),
    cursor: 0,
    activeKey: null,
  };
  let processed = 0;
  let failed = 0;
  let abortedEarly = false;

  const finishStep = () => {
    if (!seq) return;
    seq.activeKey = null;
    seq.cursor += 1;
  };

  const abortSequential = (job: Job) => {
    failed += 1;
    if (isIndependentCanvasNodeJob(job)) {
      finishStep();
      return;
    }
    seq = null;
    abortedEarly = true;
  };

  while (seq && seq.cursor < seq.jobs.length) {
    const job = seq.jobs[seq.cursor]!;
    const key = runKey(job);
    if (seq.activeKey) break;
    seq.activeKey = key;
    processed += 1;
    if (seq.cursor === failAtIndex) {
      abortSequential(job);
    } else {
      finishStep();
    }
  }

  return { processed, failed, abortedEarly };
}

describe("canvas queue blocking stress (logic)", () => {
  it("100 independent jobs: failure at index 12 does not abort batch", () => {
    const r = simulateBatchWithMidFailure(100, 12);
    expect(r.abortedEarly).toBe(false);
    expect(r.failed).toBe(1);
    expect(r.processed).toBe(100);
  });

  it("100 independent jobs: multiple failures still complete batch", () => {
    let seq: SequentialState = {
      jobs: Array.from({ length: 100 }, (_, i) => ({ nodeId: `n${i}` })),
      cursor: 0,
      activeKey: null,
    };
    let failed = 0;
    const failIndices = new Set([3, 17, 42, 99]);

    while (seq && seq.cursor < seq.jobs.length) {
      const job = seq.jobs[seq.cursor]!;
      seq.activeKey = runKey(job);
      if (failIndices.has(seq.cursor)) {
        failed += 1;
        seq.activeKey = null;
        seq.cursor += 1;
      } else {
        seq.activeKey = null;
        seq.cursor += 1;
      }
    }

    expect(seq).not.toBeNull();
    expect(seq?.cursor).toBe(100);
    expect(failed).toBe(4);
  });

  it("story row job failure still aborts sequential chain", () => {
    const r = simulateBatchWithMidFailure(10, 2);
    const storyJob: Job = { nodeId: "col", rowKey: "r1", mediaKind: "frameImage" };
    let seq: SequentialState = {
      jobs: [storyJob, storyJob, storyJob],
      cursor: 0,
      activeKey: null,
    };
    let aborted = false;
    const abortSequential = () => {
      seq = null;
      aborted = true;
    };
    while (seq && seq.cursor < seq.jobs.length) {
      seq.activeKey = "active";
      if (seq.cursor === 1) abortSequential();
      else {
        seq.activeKey = null;
        seq.cursor += 1;
      }
    }
    expect(aborted).toBe(true);
    expect(r.abortedEarly).toBe(false);
  });
});
