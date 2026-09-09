import { describe, expect, it } from "vitest";

import { mergeVtonMeta } from "@/lib/ecom/ecom-vton/meta";

describe("mergeVtonMeta", () => {
  it("preserves tryonBatchCancelBatchId when patch omits it", () => {
    const merged = mergeVtonMeta(
      { tryonBatchCancelBatchId: "batch-1", garmentPool: [] },
      {
        tryonBatch: {
          batchId: "batch-1",
          status: "running",
          currentIndex: 1,
          total: 3,
          results: [],
          updatedAt: new Date().toISOString(),
        },
      },
    );
    expect(merged.tryonBatchCancelBatchId).toBe("batch-1");
  });
});
