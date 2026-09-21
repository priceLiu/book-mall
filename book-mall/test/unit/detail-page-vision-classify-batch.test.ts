import { describe, expect, it } from "vitest";

import {
  chunkDetailPageVisionSegments,
  DETAIL_PAGE_VISION_CLASSIFY_BATCH_SIZE,
} from "@/lib/ecom/detail-page-vision-decompose/inventory-classify-batch";

describe("chunkDetailPageVisionSegments", () => {
  it("splits 49 segments into batches of 12", () => {
    const items = Array.from({ length: 49 }, (_, i) => i);
    const chunks = chunkDetailPageVisionSegments(items, DETAIL_PAGE_VISION_CLASSIFY_BATCH_SIZE);
    expect(chunks).toHaveLength(5);
    expect(chunks[0]).toHaveLength(12);
    expect(chunks[4]).toHaveLength(1);
  });
});
