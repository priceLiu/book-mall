import { describe, expect, it, vi } from "vitest";

import { finalizeIpWorkflowStepAfterBatch } from "@/lib/ecom/ecom-ip-workflow-step-gen-finalize";

describe("finalizeIpWorkflowStepAfterBatch", () => {
  it("marks wanted indexes never attempted as failures without overwriting slots", async () => {
    const patchStep = vi.fn(async () => undefined);
    const failures: Array<{ index: number; message: string }> = [];

    await finalizeIpWorkflowStepAfterBatch({
      slotsSnapshot: [
        { index: 1, title: "a", prompt: "", imageUrl: "https://x/1.png" },
        { index: 2, title: "b", prompt: "", imageUrl: "" },
      ],
      wantedIndexes: [1, 2, 3, 4],
      generated: 1,
      failures,
      readStepSlots: async () => [
        { index: 1, title: "a", prompt: "", imageUrl: "https://x/1.png" },
        { index: 2, title: "b", prompt: "", imageUrl: "" },
        { index: 3, title: "c", prompt: "", imageUrl: "" },
        { index: 4, title: "d", prompt: "", imageUrl: "" },
      ],
      patchStep,
    });

    expect(patchStep).toHaveBeenCalledWith({ status: "pending" });
    expect(patchStep.mock.calls[0][0]).not.toHaveProperty("slots");
    expect(failures.map((f) => f.index).sort()).toEqual([2, 3, 4]);
    expect(failures.some((f) => f.index === 3 && f.message.includes("未执行"))).toBe(true);
  });

  it("sets ready when all db slots have images", async () => {
    const patchStep = vi.fn(async () => undefined);
    await finalizeIpWorkflowStepAfterBatch({
      slotsSnapshot: [],
      wantedIndexes: [1],
      generated: 0,
      failures: [],
      readStepSlots: async () => [
        { index: 1, title: "a", prompt: "", imageUrl: "https://x/1.png" },
      ],
      patchStep,
    });
    expect(patchStep).toHaveBeenCalledWith({ status: "ready" });
  });
});
