import { describe, expect, it } from "vitest";

import {
  classifyKieGatewayWatchdogRow,
  classifyWatchdogSyncError,
} from "@/lib/gateway/gateway-watchdog-classifier";

const baseRow = {
  id: "log1",
  requestKind: "IMAGE" as const,
  externalTaskId: "task-1",
  credentialId: "cred-1",
  submittedAt: new Date("2026-01-01T00:00:00.000Z"),
  lastPolledAt: new Date("2026-01-01T00:01:00.000Z"),
  pollCount: 3,
  resultSummary: {
    kind: "task_progress",
    status: "generating",
  },
};

describe("gateway-watchdog-classifier", () => {
  it("continues when vendor in-flight and poll healthy", () => {
    const verdict = classifyKieGatewayWatchdogRow({
      ...baseRow,
      nowMs: new Date("2026-01-01T00:01:30.000Z").getTime(),
    });
    expect(verdict.outcome).toBe("continue");
    if (verdict.outcome === "continue") {
      expect(verdict.waiting).toBe("vendor_in_flight");
    }
  });

  it("recovers when poll worker stale", () => {
    const verdict = classifyKieGatewayWatchdogRow({
      ...baseRow,
      lastPolledAt: new Date("2026-01-01T00:00:10.000Z"),
      nowMs: new Date("2026-01-01T00:03:00.000Z").getTime(),
    });
    expect(verdict.outcome).toBe("recover");
    if (verdict.outcome === "recover") {
      expect(verdict.blocked).toBe("poll_worker_stale");
    }
  });

  it("recovers when vendor success desync in progress snapshot", () => {
    const verdict = classifyKieGatewayWatchdogRow({
      ...baseRow,
      resultSummary: { kind: "task_progress", status: "success" },
      nowMs: new Date("2026-01-01T00:02:00.000Z").getTime(),
    });
    expect(verdict.outcome).toBe("recover");
    if (verdict.outcome === "recover") {
      expect(verdict.blocked).toBe("vendor_success_desync");
    }
  });

  it("db_release_retry on pool timeout poll attempt", () => {
    const verdict = classifyKieGatewayWatchdogRow({
      ...baseRow,
      resultSummary: {
        kind: "task_progress",
        status: "generating",
        _gateway: {
          lastPollAttempt: {
            at: "2026-01-01T00:01:00.000Z",
            ok: false,
            kind: "db",
            error: "Timed out fetching a new connection from the connection pool",
          },
        },
      },
      nowMs: new Date("2026-01-01T00:02:00.000Z").getTime(),
    });
    expect(verdict.outcome).toBe("db_release_retry");
  });

  it("does not fail before hard max while vendor still generating", () => {
    const verdict = classifyKieGatewayWatchdogRow({
      ...baseRow,
      lastPolledAt: new Date("2026-01-01T00:14:00.000Z"),
      nowMs: new Date("2026-01-01T00:20:00.000Z").getTime(),
    });
    expect(verdict.outcome).not.toBe("fail");
  });

  it("fails at hard max when vendor still in-flight", () => {
    const verdict = classifyKieGatewayWatchdogRow({
      ...baseRow,
      lastPolledAt: new Date("2026-01-01T00:29:00.000Z"),
      nowMs: new Date("2026-01-01T00:31:00.000Z").getTime(),
    });
    expect(verdict.outcome).toBe("fail");
    if (verdict.outcome === "fail") {
      expect(verdict.failCode).toBe("STALE_TIMEOUT");
    }
  });

  it("classifies sync pool error as db_release_retry", () => {
    const verdict = classifyWatchdogSyncError(
      new Error("Timed out fetching a new connection from the connection pool"),
    );
    expect(verdict.outcome).toBe("db_release_retry");
  });
});
