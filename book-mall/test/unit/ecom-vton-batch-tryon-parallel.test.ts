import { describe, expect, it } from "vitest";

import {
  formatVtonBatchRunningProgressLabel,
  formatVtonBatchTryonLabel,
  VTON_BATCH_TRYON_CONCURRENCY,
} from "@/lib/ecom/ecom-vton/batch-tryon";
import type { VtonTryonBatchState } from "@/lib/ecom/ecom-vton/types";

describe("ecom-vton batch tryon parallel", () => {
  it("exposes default concurrency", () => {
    expect(VTON_BATCH_TRYON_CONCURRENCY).toBeGreaterThan(1);
  });

  it("shows parallel count in running label", () => {
    const label = formatVtonBatchRunningProgressLabel({
      total: 5,
      results: [
        { id: "1", lookId: "l1", status: "success", createdAt: "" },
        { id: "2", lookId: "l2", status: "running", createdAt: "" },
        { id: "3", lookId: "l3", status: "running", createdAt: "" },
        { id: "4", lookId: "l4", status: "pending", createdAt: "" },
        { id: "5", lookId: "l5", status: "pending", createdAt: "" },
      ],
    });
    expect(label).toBe("试衣中 1/5（2 套并行）…");
  });

  it("formatVtonBatchTryonLabel preserves custom running progress label", () => {
    const batch: VtonTryonBatchState = {
      batchId: "b1",
      status: "running",
      currentIndex: 2,
      total: 5,
      label: "试衣中 2/5（3 套并行）…",
      results: [],
      updatedAt: new Date().toISOString(),
    };
    expect(formatVtonBatchTryonLabel(batch)).toBe("试衣中 2/5（3 套并行）…");
  });
});
