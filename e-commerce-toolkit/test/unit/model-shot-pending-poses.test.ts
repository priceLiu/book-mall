import { describe, expect, it } from "vitest";

import {
  listOrphanModelShotPendingPoseIndices,
  resolveActiveModelShotPoseBusyIndexes,
} from "@/lib/model-shot-pending-poses";

describe("resolveActiveModelShotPoseBusyIndexes", () => {
  const items = [
    { index: 1, imageUrl: "https://a/1.png", prompt: "", status: "ready" as const },
    { index: 2, imageUrl: undefined, prompt: "p2", status: "generating" as const },
    { index: 3, imageUrl: undefined, prompt: "p3" },
  ];

  it("keeps server pending busy after refresh when watch restored from pending", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [2, 3],
        localWatchIndices: [2, 3],
        imageGenInFlight: false,
        items,
      }),
    ).toEqual([2, 3]);
  });

  it("includes plan items with status generating", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [],
        localWatchIndices: [],
        imageGenInFlight: false,
        items,
      }),
    ).toEqual([2]);
  });

  it("selective batch in flight ignores stale pending outside watch", () => {
    expect(
      resolveActiveModelShotPoseBusyIndexes({
        pendingIndices: [1, 2, 3, 4],
        localWatchIndices: [2, 3],
        imageGenInFlight: true,
        items: [
          { index: 1, prompt: "" },
          { index: 2, prompt: "" },
          { index: 3, prompt: "" },
          { index: 4, prompt: "" },
        ],
      }),
    ).toEqual([2, 3]);
  });
});

describe("listOrphanModelShotPendingPoseIndices", () => {
  it("does not clear pending covered by restored watch", () => {
    const orphans = listOrphanModelShotPendingPoseIndices(
      {
        workflow: {
          pendingPoseImages: {
            "2": { startedAt: new Date().toISOString() },
          },
        },
      },
      [{ index: 2, prompt: "" }],
      { imageGenInFlight: false, localWatchIndices: [2] },
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
      { imageGenInFlight: false, localWatchIndices: [] },
    );
    expect(orphans).toEqual([1]);
  });
});
