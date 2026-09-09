import { describe, expect, it } from "vitest";

import {
  formatVtonBatchTryonLabel,
  resolveVtonBatchTryonProgressPhase,
} from "@/lib/ecom/ecom-vton/batch-tryon";
import type { VtonTryonBatchState } from "@/lib/ecom/ecom-vton/types";

function batch(partial: Partial<VtonTryonBatchState>): VtonTryonBatchState {
  return {
    batchId: "b1",
    status: "running",
    currentIndex: 1,
    total: 3,
    results: [],
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("formatVtonBatchTryonLabel", () => {
  it("uses look index while running", () => {
    expect(formatVtonBatchTryonLabel(batch({ currentIndex: 2, total: 5 }))).toBe("试衣中 2/5…");
  });

  it("does not show single-item submit label", () => {
    expect(
      formatVtonBatchTryonLabel(
        batch({ currentIndex: 1, total: 3, label: "提交 AI 试衣任务…" }),
      ),
    ).toBe("试衣中 1/3…");
  });

  it("shows queue label before first look starts", () => {
    expect(formatVtonBatchTryonLabel(batch({ currentIndex: 0, label: "排队中…" }))).toBe("排队中…");
  });
});

describe("resolveVtonBatchTryonProgressPhase", () => {
  it("maps item submitting to submitting step", () => {
    expect(
      resolveVtonBatchTryonProgressPhase(batch({ currentIndex: 1 }), {
        phase: "submitting",
        label: "提交 AI 试衣任务…",
        updatedAt: new Date().toISOString(),
      }),
    ).toBe("submitting");
  });

  it("maps item polling to polling step", () => {
    expect(
      resolveVtonBatchTryonProgressPhase(batch({ currentIndex: 1 }), {
        phase: "polling",
        label: "AI 试衣生成中…",
        updatedAt: new Date().toISOString(),
      }),
    ).toBe("polling");
  });
});
