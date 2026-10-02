import { describe, expect, it } from "vitest";

import { mergeIpWorkflowStepSlots } from "@/lib/ecom/ecom-ip-workflow-slot-merge";
import { reconcileIpWorkflowPlanFromAssets } from "@/lib/ecom/ecom-ip-workflow-asset-reconcile";

describe("mergeIpWorkflowStepSlots", () => {
  it("keeps imageUrl from DB when patch batch omits it", () => {
    const prev = [
      { index: 1, imageUrl: "https://a/1.png", assetId: "a1" },
      { index: 2, imageUrl: "https://a/2.png", assetId: "a2" },
    ];
    const patch = [
      { index: 1, title: "t1" },
      { index: 2, title: "t2" },
      { index: 3, imageUrl: "https://a/3.png", assetId: "a3" },
    ];
    const merged = mergeIpWorkflowStepSlots(prev, patch);
    expect(merged.find((s) => s.index === 1)?.imageUrl).toBe("https://a/1.png");
    expect(merged.find((s) => s.index === 2)?.imageUrl).toBe("https://a/2.png");
    expect(merged.find((s) => s.index === 3)?.imageUrl).toBe("https://a/3.png");
  });
});

describe("reconcileIpWorkflowPlanFromAssets", () => {
  it("fills empty slots from latest asset per step index", () => {
    const plan = {
      steps: {
        emoji: {
          stepId: "emoji",
          status: "pending",
          slots: [
            { index: 4, title: "4" },
            { index: 8, title: "8" },
            { index: 9, title: "9" },
          ],
        },
      },
    };
    const byStepIndex = new Map([
      [
        "emoji::4",
        {
          id: "asset-4",
          ossUrl: "https://oss/4.png",
          prompt: "p4",
          createdAt: new Date("2026-01-01"),
        },
      ],
      [
        "emoji::8",
        {
          id: "asset-8",
          ossUrl: "https://oss/8.png",
          prompt: null,
          createdAt: new Date("2026-01-02"),
        },
      ],
    ]);
    const { plan: next, recoveredImages } = reconcileIpWorkflowPlanFromAssets({
      plan,
      byStepIndex,
      resolveSlotTemplate: (stepId, index) => ({
        index,
        title: `${stepId}-${index}`,
        prompt: "",
      }),
    });
    expect(recoveredImages).toBe(2);
    const slots = next.steps.emoji!.slots;
    expect(slots.find((s) => s.index === 4)?.imageUrl).toBe("https://oss/4.png");
    expect(slots.find((s) => s.index === 8)?.imageUrl).toBe("https://oss/8.png");
    expect(slots.find((s) => s.index === 9)?.imageUrl).toBeUndefined();
  });
});
