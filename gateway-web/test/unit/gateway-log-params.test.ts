import { describe, expect, it } from "vitest";

import { resolveLogDisplayDurationMs } from "@/lib/gateway-log-params";

describe("resolveLogDisplayDurationMs", () => {
  it("in-progress prefers submitted wall clock over phase sum", () => {
    const submittedAt = new Date(1_000_000).toISOString();
    const nowMs = 1_000_000 + 80_000;
    const ms = resolveLogDisplayDurationMs({
      durationMs: null,
      submittedAt,
      completedAt: null,
      isInProgress: true,
      nowMs,
      queueMs: 1_000,
      generateMs: 79_000,
      pollDelayMs: 73_000,
      liveTotalMs: 152_000,
    });
    expect(ms).toBe(80_000);
  });

  it("terminal uses stored durationMs", () => {
    const ms = resolveLogDisplayDurationMs({
      durationMs: 295_000,
      submittedAt: new Date(0).toISOString(),
      completedAt: new Date(295_000).toISOString(),
      isInProgress: false,
      nowMs: null,
    });
    expect(ms).toBe(295_000);
  });
});
