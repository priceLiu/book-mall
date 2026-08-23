import { describe, expect, it } from "vitest";

import {
  evaluateGatewayHealthAlerts,
  gatewayHealthOpsStatus,
  type GatewayHealthCounts,
} from "@/lib/gateway/gateway-health-alerts";

function counts(partial: Partial<GatewayHealthCounts>): GatewayHealthCounts {
  return {
    staleChat: 0,
    chatLong: 0,
    staleAsync: 0,
    staleVideo: 0,
    videoHard: 0,
    canvasStaleDispatch: 0,
    inflight: 0,
    pollWorkerStale: false,
    pollWorkerAgeMs: null,
    ...partial,
  };
}

describe("evaluateGatewayHealthAlerts", () => {
  it("is healthy when all zeros", () => {
    const alerts = evaluateGatewayHealthAlerts(counts({}));
    expect(alerts).toEqual([]);
    expect(gatewayHealthOpsStatus(alerts)).toBe("healthy");
  });

  it("marks stale CHAT as CRITICAL", () => {
    const alerts = evaluateGatewayHealthAlerts(counts({ staleChat: 12 }));
    expect(alerts.some((a) => a.code === "STALE_CHAT" && a.level === "CRITICAL")).toBe(
      true,
    );
    expect(gatewayHealthOpsStatus(alerts)).toBe("critical");
  });

  it("marks 10-15min CHAT as WARN only", () => {
    const alerts = evaluateGatewayHealthAlerts(counts({ chatLong: 3 }));
    expect(alerts).toEqual([
      expect.objectContaining({ code: "CHAT_LONG", level: "WARN", value: 3 }),
    ]);
    expect(gatewayHealthOpsStatus(alerts)).toBe("warn");
  });

  it("prefers VIDEO_HARD over STALE_VIDEO", () => {
    const alerts = evaluateGatewayHealthAlerts(
      counts({ staleVideo: 4, videoHard: 2 }),
    );
    expect(alerts.some((a) => a.code === "VIDEO_HARD")).toBe(true);
    expect(alerts.some((a) => a.code === "STALE_VIDEO")).toBe(false);
  });

  it("alerts on poll worker stale", () => {
    const alerts = evaluateGatewayHealthAlerts(
      counts({ pollWorkerStale: true, pollWorkerAgeMs: 240_000 }),
    );
    expect(alerts.some((a) => a.code === "POLL_WORKER_STALE")).toBe(true);
    expect(gatewayHealthOpsStatus(alerts)).toBe("critical");
  });

  it("alerts on inflight spike", () => {
    const alerts = evaluateGatewayHealthAlerts(counts({ inflight: 80 }));
    expect(alerts.some((a) => a.code === "INFLIGHT_SPIKE" && a.level === "WARN")).toBe(
      true,
    );
    const critical = evaluateGatewayHealthAlerts(counts({ inflight: 160 }));
    expect(critical.some((a) => a.code === "INFLIGHT_SPIKE" && a.level === "CRITICAL")).toBe(
      true,
    );
  });
});
