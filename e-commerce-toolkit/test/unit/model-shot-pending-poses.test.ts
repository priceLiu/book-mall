import { describe, expect, it } from "vitest";

import {
  listOrphanModelShotPendingPoseIndices,
  modelShotTargetIndexesGainedImages,
  modelShotTargetIndexesHaveImages,
  resolveActiveModelShotPoseBusyIndexes,
} from "@/lib/model-shot-pending-poses";

describe("resolveActiveModelShotPoseBusyIndexes", () => {
  const items = [
    { index: 1, imageUrl: "https://a/1.png", prompt: "", status: "ready" as const },
    { index: 2, imageUrl: undefined, prompt: "p2", status: "generating" as const },
    { index: 3, imageUrl: undefined, prompt: "p3" },
  ];

  it("clears busy for completed pose even when local watch still tracks batch", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [3],
        localWatchIndices: [1, 2, 3],
        items: [
          { index: 1, imageUrl: "https://a/1.png", prompt: "", status: "ready" as const },
          { index: 2, imageUrl: "https://a/2.png", prompt: "", status: "ready" as const },
          { index: 3, prompt: "p3", status: "generating" as const },
        ],
      }),
    ).toEqual([3]);
  });

  it("keeps server pending busy after refresh when watch restored from pending", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [2, 3],
        localWatchIndices: [2, 3],
        items,
      }),
    ).toEqual([2, 3]);
  });

  it("includes plan items with status generating", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [],
        localWatchIndices: [],
        items,
      }),
    ).toEqual([2]);
  });

  it("clears busy when image exists in history without imageUrl", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [],
        localWatchIndices: [],
        items: [
          {
            index: 3,
            prompt: "p3",
            imageHistory: [{ url: "https://a/3.png", createdAt: "2026-01-01T00:00:00.000Z" }],
          },
        ],
      }),
    ).toEqual([]);
  });
});

describe("listOrphanModelShotPendingPoseIndices", () => {
  it("does not clear active non-stale pending without local watch", () => {
    const orphans = listOrphanModelShotPendingPoseIndices(
      {
        workflow: {
          pendingPoseImages: {
            "2": { startedAt: new Date().toISOString() },
          },
        },
      },
      [{ index: 2, prompt: "" }],
      { localInFlight: false, localWatchIndices: [] },
    );
    expect(orphans).toEqual([]);
  });

  it("clears stale pending without watch", () => {
    const orphans = listOrphanModelShotPendingPoseIndices(
      {
        workflow: {
          pendingPoseImages: {
            "1": { startedAt: "2020-01-01T00:00:00.000Z" },
          },
        },
      },
      [{ index: 1, prompt: "" }],
      { localInFlight: false, localWatchIndices: [] },
    );
    expect(orphans).toEqual([1]);
  });

  it("clears pending when pose already has imageHistory", () => {
    const orphans = listOrphanModelShotPendingPoseIndices(
      {
        workflow: {
          pendingPoseImages: {
            "3": { startedAt: new Date().toISOString() },
          },
        },
      },
      [
        {
          index: 3,
          prompt: "",
          imageHistory: [{ url: "https://a/3.png", createdAt: "2026-01-01T00:00:00.000Z" }],
        },
      ],
      { localInFlight: false, localWatchIndices: [] },
    );
    expect(orphans).toEqual([3]);
  });
});

describe("modelShotTargetIndexesHaveImages", () => {
  it("detects images from imageHistory", () => {
    expect(
      modelShotTargetIndexesHaveImages(
        [
          {
            index: 3,
            prompt: "",
            imageHistory: [{ url: "https://a/3.png", createdAt: "2026-01-01T00:00:00.000Z" }],
          },
        ],
        [3],
      ),
    ).toBe(true);
  });
});

describe("modelShotTargetIndexesGainedImages", () => {
  it("detects newly added history version", () => {
    const before = [{ index: 3, prompt: "" }];
    const after = [
      {
        index: 3,
        prompt: "",
        imageHistory: [{ url: "https://a/3.png", createdAt: "2026-01-01T00:00:00.000Z" }],
      },
    ];
    expect(modelShotTargetIndexesGainedImages(before, after, [3])).toBe(true);
  });
});
