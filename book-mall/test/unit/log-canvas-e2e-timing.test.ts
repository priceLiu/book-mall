import { describe, expect, it } from "vitest";

import {
  buildCanvasE2eTiming,
  readCanvasE2eTiming,
  resolveCanvasE2eForLogRow,
} from "@/lib/gateway/log-canvas-e2e-timing";

describe("log-canvas-e2e-timing", () => {
  it("buildCanvasE2eTiming splits pre/gateway/post segments", () => {
    const started = new Date("2026-06-24T12:42:47.635Z");
    const submitted = new Date("2026-06-24T12:50:45.052Z");
    const gatewayDone = new Date("2026-06-24T12:55:09.054Z");
    const canvasDone = new Date("2026-06-24T12:56:51.350Z");

    const record = buildCanvasE2eTiming({
      log: {
        submittedAt: submitted,
        completedAt: gatewayDone,
        durationMs: 264_002,
      },
      canvasTask: {
        id: "task1",
        createdAt: started,
        queuedAt: started,
        completedAt: canvasDone,
      },
      anchorMs: canvasDone.getTime(),
      freeze: true,
    });

    expect(record.preGatewayMs).toBeGreaterThan(470_000);
    expect(record.preGatewayMs).toBeLessThan(480_000);
    expect(record.gatewayMs).toBe(264_002);
    expect(record.postGatewayMs).toBeGreaterThan(100_000);
    expect(record.e2eMs).toBeGreaterThan(840_000);
    expect(record.e2eMs).toBeLessThan(850_000);
  });

  it("resolveCanvasE2eForLogRow prefers frozen stored record", () => {
    const summary = {
      _gateway: {
        canvasE2e: {
          kind: "canvas_e2e",
          canvasTaskId: "t1",
          startedAtMs: 1_000_000,
          displayReadyAtMs: 2_000_000,
          preGatewayMs: 100,
          gatewayMs: 200,
          postGatewayMs: 50,
          e2eMs: 1_000_000,
        },
      },
    };
    const row = resolveCanvasE2eForLogRow({
      log: {
        submittedAt: new Date(1_100_000),
        completedAt: new Date(1_300_000),
        durationMs: 200,
        status: "SUCCEEDED",
        resultSummary: summary,
      },
      canvasTask: null,
    });
    expect(row.e2eMs).toBe(1_000_000);
    expect(row.e2eFrozen).toBe(true);
    expect(readCanvasE2eTiming(summary)?.e2eMs).toBe(1_000_000);
  });
});
