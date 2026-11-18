import { describe, expect, it } from "vitest";

import { classifyOpenReserve } from "@/lib/billing/credit-traffic-control";

const grace = 2 * 60 * 1000;
const running = 30 * 60 * 1000;

describe("classifyOpenReserve", () => {
  it("keeps a fresh running hold in flight", () => {
    expect(
      classifyOpenReserve({
        logStatus: "RUNNING",
        ageMs: 60_000,
        hasSettle: false,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("in_flight");
  });

  it("marks a long-running hold stale instead of auto-releasing", () => {
    expect(
      classifyOpenReserve({
        logStatus: "RUNNING",
        ageMs: running + 1,
        hasSettle: false,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("stale_running");
  });

  it("releases failed holds after the grace window", () => {
    expect(
      classifyOpenReserve({
        logStatus: "FAILED",
        ageMs: grace + 1,
        hasSettle: false,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("release");
  });

  it("does not release a failure still inside the grace window", () => {
    expect(
      classifyOpenReserve({
        logStatus: "FAILED",
        ageMs: 1_000,
        hasSettle: false,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("in_flight");
  });

  it("settles a successful hold that never closed", () => {
    expect(
      classifyOpenReserve({
        logStatus: "SUCCEEDED",
        ageMs: grace + 1,
        hasSettle: false,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("settle_frozen");
  });

  it("treats settle or release as closed", () => {
    expect(
      classifyOpenReserve({
        logStatus: "FAILED",
        ageMs: grace + 5_000,
        hasSettle: false,
        hasRelease: true,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("closed");
    expect(
      classifyOpenReserve({
        logStatus: "SUCCEEDED",
        ageMs: grace + 5_000,
        hasSettle: true,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("closed");
  });

  it("releases an orphan reserve once the grace window passes", () => {
    expect(
      classifyOpenReserve({
        logStatus: null,
        ageMs: grace + 1,
        hasSettle: false,
        hasRelease: false,
        runningTimeoutMs: running,
        terminalGraceMs: grace,
      }),
    ).toBe("release");
  });
});
