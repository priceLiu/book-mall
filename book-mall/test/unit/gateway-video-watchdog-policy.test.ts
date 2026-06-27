import { describe, expect, it } from "vitest";

import {
  attachWatchdogLastRecoverAtMs,
  decideWatchdogVendorCheck,
  readWatchdogLastRecoverAtMs,
} from "@/lib/gateway/gateway-video-watchdog-policy";

describe("decideWatchdogVendorCheck", () => {
  const submittedAtMs = 1_000_000;
  const checkpointsSec = [300, 500, 600, 900];

  it("poll_stale: age and poll lag both exceed thresholds", () => {
    const nowMs = submittedAtMs + 400_000;
    expect(
      decideWatchdogVendorCheck({
        submittedAtMs,
        nowMs,
        lastPolledAtMs: nowMs - 120_000,
        lastWatchdogRecoverAtMs: null,
        checkpointsSec,
      }),
    ).toEqual({ due: true, reason: "poll_stale" });
  });

  it("checkpoint at 300s even when poll is fresh (active poll loop, vendor stuck)", () => {
    const nowMs = submittedAtMs + 310_000;
    expect(
      decideWatchdogVendorCheck({
        submittedAtMs,
        nowMs,
        lastPolledAtMs: nowMs - 5_000,
        lastWatchdogRecoverAtMs: null,
        checkpointsSec,
      }),
    ).toEqual({ due: true, reason: "checkpoint", checkpointSec: 300 });
  });

  it("checkpoint at 500s after recover at 300s", () => {
    const nowMs = submittedAtMs + 510_000;
    expect(
      decideWatchdogVendorCheck({
        submittedAtMs,
        nowMs,
        lastPolledAtMs: nowMs - 3_000,
        lastWatchdogRecoverAtMs: submittedAtMs + 305_000,
        checkpointsSec,
      }),
    ).toEqual({ due: true, reason: "checkpoint", checkpointSec: 500 });
  });

  it("not due between checkpoints if already recovered for current tier", () => {
    const nowMs = submittedAtMs + 450_000;
    expect(
      decideWatchdogVendorCheck({
        submittedAtMs,
        nowMs,
        lastPolledAtMs: nowMs - 3_000,
        lastWatchdogRecoverAtMs: submittedAtMs + 305_000,
        checkpointsSec,
      }),
    ).toEqual({ due: false, reason: null });
  });

  it("interval after last checkpoint when gap elapsed", () => {
    const nowMs = submittedAtMs + 1_040_000;
    expect(
      decideWatchdogVendorCheck({
        submittedAtMs,
        nowMs,
        lastPolledAtMs: nowMs - 2_000,
        lastWatchdogRecoverAtMs: submittedAtMs + 905_000,
        checkpointsSec,
      }),
    ).toEqual({ due: true, reason: "interval", checkpointSec: 1040 });
  });
});

describe("watchdog recover meta in resultSummary", () => {
  it("roundtrips watchdogLastRecoverAtMs", () => {
    const at = 9_000_000;
    const next = attachWatchdogLastRecoverAtMs(null, at);
    expect(readWatchdogLastRecoverAtMs(next)).toBe(at);
  });
});
