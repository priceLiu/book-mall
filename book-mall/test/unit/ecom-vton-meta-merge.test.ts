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

  it("preserves in-flight textTryonJob and modelPipelineJob", () => {
    const merged = mergeVtonMeta(
      {
        textTryonJob: {
          jobId: "job-1",
          status: "running",
          startedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          prompt: "试衣",
          modelKey: "wan2.7-image-pro",
        },
        modelPipelineJob: {
          jobId: "job-2",
          status: "running",
          kind: "generating-model",
          startedAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      },
      { textTryonPrompt: "新提示" },
    );
    expect(merged.textTryonJob?.jobId).toBe("job-1");
    expect(merged.textTryonJob?.status).toBe("running");
    expect(merged.modelPipelineJob?.jobId).toBe("job-2");
    expect(merged.textTryonPrompt).toBe("新提示");
  });
});
