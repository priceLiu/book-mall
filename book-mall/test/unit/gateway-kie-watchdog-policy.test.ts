import { describe, expect, it } from "vitest";

import {
  kieWatchdogImageCheckpointSec,
  kieWatchdogVideoCheckpointSec,
  readKieWatchdogChannelMeta,
  attachKieWatchdogChannelMeta,
} from "@/lib/gateway/gateway-kie-watchdog-policy";
import {
  decideWatchdogVendorCheck,
} from "@/lib/gateway/gateway-video-watchdog-policy";

describe("gateway-kie-watchdog-policy", () => {
  it("parses image checkpoints with defaults", () => {
    expect(kieWatchdogImageCheckpointSec()).toEqual([45, 90, 180, 300]);
  });

  it("parses video checkpoints with defaults", () => {
    expect(kieWatchdogVideoCheckpointSec()).toEqual([120, 300, 600, 900]);
  });

  it("tracks channel failure meta under _gateway", () => {
    const next = attachKieWatchdogChannelMeta(null, {
      consecutiveFailures: 2,
      lastError: "network",
      lastErrorAt: "2026-01-01T00:00:00.000Z",
    });
    const meta = readKieWatchdogChannelMeta(next);
    expect(meta.consecutiveFailures).toBe(2);
    expect(meta.lastError).toBe("network");
  });

  it("fires checkpoint for KIE image at 90s", () => {
    const submittedAtMs = 1_000_000;
    const decision = decideWatchdogVendorCheck({
      submittedAtMs,
      nowMs: submittedAtMs + 95_000,
      lastPolledAtMs: submittedAtMs + 90_000,
      lastWatchdogRecoverAtMs: submittedAtMs + 50_000,
      checkpointsSec: kieWatchdogImageCheckpointSec(),
      workerStaleMs: 45_000,
      tooLongMs: 75_000,
      minRecoverGapMs: 30_000,
      intervalAfterLastCheckpointMs: 60_000,
    });
    expect(decision.due).toBe(true);
    expect(decision.reason).toBe("checkpoint");
    expect(decision.checkpointSec).toBe(90);
  });

  it("detects poll_stale when worker stops ticking", () => {
    const submittedAtMs = 1_000_000;
    const decision = decideWatchdogVendorCheck({
      submittedAtMs,
      nowMs: submittedAtMs + 120_000,
      lastPolledAtMs: submittedAtMs + 10_000,
      lastWatchdogRecoverAtMs: null,
      checkpointsSec: kieWatchdogImageCheckpointSec(),
      workerStaleMs: 45_000,
      tooLongMs: 75_000,
      minRecoverGapMs: 30_000,
      intervalAfterLastCheckpointMs: 60_000,
    });
    expect(decision.due).toBe(true);
    expect(decision.reason).toBe("poll_stale");
  });
});
