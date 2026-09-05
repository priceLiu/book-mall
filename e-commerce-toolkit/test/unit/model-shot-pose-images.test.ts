import { describe, expect, it } from "vitest";

import {
  listModelShotAllGeneratedImages,
  resolveModelShotActiveImageIndex,
  resolveModelShotPoseImageHistory,
} from "@/lib/model-shot-pose-images";
import type { ModelShotPoseItem } from "@/lib/model-shot-types";

describe("model-shot pose image history", () => {
  it("migrates legacy single imageUrl to history", () => {
    const item: ModelShotPoseItem = {
      index: 1,
      prompt: "test",
      imageUrl: "https://example.com/v1.jpg",
      assetId: "a1",
    };
    expect(resolveModelShotPoseImageHistory(item)).toEqual([
      expect.objectContaining({ url: "https://example.com/v1.jpg", assetId: "a1" }),
    ]);
  });

  it("reads active index from imageHistory", () => {
    const item: ModelShotPoseItem = {
      index: 1,
      prompt: "test",
      imageUrl: "https://example.com/v2.jpg",
      imageHistory: [
        { url: "https://example.com/v1.jpg", createdAt: "2026-01-01T00:00:00.000Z" },
        { url: "https://example.com/v2.jpg", createdAt: "2026-01-02T00:00:00.000Z" },
      ],
      activeImageIndex: 0,
    };
    expect(resolveModelShotActiveImageIndex(item)).toBe(0);
  });

  it("lists all generated images for sidebar", () => {
    const items: ModelShotPoseItem[] = [
      {
        index: 1,
        title: "站姿",
        prompt: "p1",
        imageHistory: [
          { url: "https://example.com/a.jpg", createdAt: "2026-01-01T00:00:00.000Z" },
          { url: "https://example.com/b.jpg", createdAt: "2026-01-02T00:00:00.000Z" },
        ],
      },
      {
        index: 2,
        title: "走步",
        prompt: "p2",
        imageUrl: "https://example.com/c.jpg",
      },
    ];
    const entries = listModelShotAllGeneratedImages(items);
    expect(entries).toHaveLength(3);
    expect(entries[0]?.poseTitle).toBe("站姿");
    expect(entries[2]?.url).toBe("https://example.com/c.jpg");
  });
});
