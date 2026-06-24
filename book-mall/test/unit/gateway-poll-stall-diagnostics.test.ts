import { describe, expect, it } from "vitest";

import {
  readPollLastAttempt,
  readPollStallDiagnostic,
} from "@/lib/gateway/gateway-poll-stall-diagnostics";

describe("gateway poll stall diagnostics", () => {
  it("readPollLastAttempt from resultSummary._gateway", () => {
    const summary = {
      _gateway: {
        lastPollAttempt: {
          at: "2026-06-24T11:00:00.000Z",
          ok: false,
          kind: "db",
          error: "Timed out fetching a new connection from the connection pool",
        },
      },
    };
    const attempt = readPollLastAttempt(summary);
    expect(attempt?.ok).toBe(false);
    expect(attempt?.kind).toBe("db");
    expect(attempt?.error).toContain("connection pool");
  });

  it("readPollStallDiagnostic from persisted payload", () => {
    const summary = {
      _gateway: {
        pollStallDiagnostic: {
          kind: "gateway_poll_stall",
          checkedAt: "2026-06-24T11:00:00.000Z",
          pollLagMs: 431_000,
          pollLagSec: 431,
          cause: "batch_starved_slow_queue",
          hint: "本轮 poll worker 慢任务通道已满",
          batchLimit: 20,
          slowRunningTotal: 35,
          selectedThisTick: false,
        },
      },
    };
    const diag = readPollStallDiagnostic(summary);
    expect(diag?.cause).toBe("batch_starved_slow_queue");
    expect(diag?.pollLagSec).toBe(431);
    expect(diag?.selectedThisTick).toBe(false);
  });
});
