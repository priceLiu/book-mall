import { describe, expect, it } from "vitest";

import {
  evaluateIpWorkflowGenPoll,
  ipWorkflowSlotUiGenerating,
} from "@/lib/ecom-ip-workflow-image-gen-dock";

describe("evaluateIpWorkflowGenPoll", () => {
  const indexes = [1, 2, 3];
  const emptySlots = indexes.map((index) => ({ index, imageUrl: null }));

  it("succeeds when slots filled but HTTP not settled yet", () => {
    const r = evaluateIpWorkflowGenPoll({
      stepStatus: "generating",
      slots: indexes.map((index) => ({ index, imageUrl: "https://x/y.png" })),
      jobIndexes: indexes,
      settled: false,
      generated: 0,
      failures: [],
      fetchError: null,
    });
    expect(r.status).toBe("succeeded");
  });

  it("stays running while API in flight and slots empty", () => {
    const r = evaluateIpWorkflowGenPoll({
      stepStatus: "generating",
      slots: emptySlots,
      jobIndexes: indexes,
      settled: false,
      generated: 0,
      failures: [],
      fetchError: null,
    });
    expect(r.status).toBe("running");
  });

  it("fails when settled with all gateway failures and no images", () => {
    const r = evaluateIpWorkflowGenPoll({
      stepStatus: "pending",
      slots: emptySlots,
      jobIndexes: indexes,
      settled: true,
      generated: 0,
      failures: indexes.map((index) => ({ index, message: "upstream error" })),
      fetchError: null,
    });
    expect(r.status).toBe("failed");
    if (r.status === "failed") expect(r.error).toContain("upstream");
  });

  it("shows slot sweep while server generating and slot in job", () => {
    expect(
      ipWorkflowSlotUiGenerating({
        stepStatus: "generating",
        slots: [{ index: 1, imageUrl: null }],
        index: 1,
        indexInActiveJob: true,
        localJobInFlight: true,
      }),
    ).toBe(true);
  });

  it("clears slot sweep when server batch ended but HTTP still open", () => {
    expect(
      ipWorkflowSlotUiGenerating({
        stepStatus: "pending",
        slots: [{ index: 1, imageUrl: null }],
        index: 1,
        indexInActiveJob: true,
        localJobInFlight: true,
      }),
    ).toBe(false);
  });

  it("clears slot sweep when job settled and step not generating", () => {
    expect(
      ipWorkflowSlotUiGenerating({
        stepStatus: "pending",
        slots: [{ index: 1, imageUrl: null }],
        index: 1,
        indexInActiveJob: true,
        localJobInFlight: false,
      }),
    ).toBe(false);
  });

  it("succeeds when all job indexes have images", () => {
    const r = evaluateIpWorkflowGenPoll({
      stepStatus: "ready",
      slots: indexes.map((index) => ({ index, imageUrl: "https://x/y.png" })),
      jobIndexes: indexes,
      settled: true,
      generated: 3,
      failures: [],
      fetchError: null,
    });
    expect(r.status).toBe("succeeded");
  });
});
