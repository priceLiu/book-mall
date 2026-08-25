import { describe, expect, it } from "vitest";

import { parseDashscopeDatetimeMs } from "@/lib/gateway/dashscope-client";
import {
  computeDashscopeTimingBreakdown,
  mergeDashscopeTimingTrace,
} from "@/lib/gateway/log-dashscope-timing";

const SUBMITTED_MS = Date.parse("2026-04-25T14:59:00.000+08:00");
const SUBMIT_TIME = "2026-04-25 15:00:01.000";
const SCHEDULED_TIME = "2026-04-25 15:00:05.000";
const END_TIME = "2026-04-25 15:01:25.000";

describe("parseDashscopeDatetimeMs", () => {
  it("parses Beijing datetime without timezone suffix", () => {
    expect(parseDashscopeDatetimeMs(SCHEDULED_TIME)).toBe(
      Date.parse("2026-04-25T15:00:05.000+08:00"),
    );
  });
});

describe("dashscope timing breakdown", () => {
  it("splits terminal success using submit / scheduled / end", () => {
    let trace = mergeDashscopeTimingTrace(null, {
      status: "RUNNING",
      output: {
        task_status: "RUNNING",
        submit_time: SUBMIT_TIME,
        scheduled_time: SCHEDULED_TIME,
      },
      polledAtMs: SUBMITTED_MS + 10_000,
    });
    trace = mergeDashscopeTimingTrace(trace, {
      status: "SUCCEEDED",
      output: {
        task_status: "SUCCEEDED",
        submit_time: SUBMIT_TIME,
        scheduled_time: SCHEDULED_TIME,
        end_time: END_TIME,
      },
      polledAtMs: Date.parse("2026-04-25T15:01:30.000+08:00"),
    });

    const scheduledMs = parseDashscopeDatetimeMs(SCHEDULED_TIME)!;
    const endMs = parseDashscopeDatetimeMs(END_TIME)!;
    const firstSuccMs = Date.parse("2026-04-25T15:01:30.000+08:00");
    const completedAtMs = Date.parse("2026-04-25T15:01:32.000+08:00");

    const breakdown = computeDashscopeTimingBreakdown({
      trace,
      submittedAtMs: SUBMITTED_MS,
      completedAtMs,
    });

    expect(breakdown.queueMs).toBe(scheduledMs - SUBMITTED_MS);
    expect(breakdown.generateMs).toBe(endMs - scheduledMs);
    expect(breakdown.vendorPostProcessMs).toBeNull();
    expect(breakdown.pollDelayMs).toBe(completedAtMs - firstSuccMs);
  });

  it("live-generates while running without end_time", () => {
    const scheduledMs = parseDashscopeDatetimeMs(SCHEDULED_TIME)!;
    const polledAtMs = scheduledMs + 45_000;
    const trace = mergeDashscopeTimingTrace(null, {
      status: "RUNNING",
      output: {
        task_status: "RUNNING",
        submit_time: SUBMIT_TIME,
        scheduled_time: SCHEDULED_TIME,
      },
      polledAtMs,
    });

    const breakdown = computeDashscopeTimingBreakdown({
      trace,
      submittedAtMs: SUBMITTED_MS,
      completedAtMs: null,
      nowMs: polledAtMs,
    });

    expect(breakdown.queueMs).toBe(scheduledMs - SUBMITTED_MS);
    expect(breakdown.generateMs).toBe(45_000);
    expect(breakdown.pollDelayMs).toBe(0);
  });
});
