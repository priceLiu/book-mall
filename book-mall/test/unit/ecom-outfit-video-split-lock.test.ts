import { describe, expect, it } from "vitest";

import {
  isOutfitSplitInProgress,
  reconcileStaleOutfitSplitState,
  releaseOutfitSplitLock,
  tryAcquireOutfitSplitLock,
} from "@/lib/ecom/ecom-outfit-video-split-lock";

describe("ecom-outfit-video-split-lock", () => {
  const projectId = "test-project-lock";

  it("rejects concurrent acquire for same project", () => {
    expect(tryAcquireOutfitSplitLock(projectId)).toBe(true);
    expect(tryAcquireOutfitSplitLock(projectId)).toBe(false);
    releaseOutfitSplitLock(projectId);
    expect(tryAcquireOutfitSplitLock(projectId)).toBe(true);
    releaseOutfitSplitLock(projectId);
  });

  it("detects in-progress meta within stale window", () => {
    expect(isOutfitSplitInProgress({ splitInProgressAt: Date.now() - 1000 })).toBe(true);
    expect(isOutfitSplitInProgress({ splitInProgressAt: Date.now() - 20 * 60_000 })).toBe(false);
    expect(isOutfitSplitInProgress(null)).toBe(false);
  });

  it("clears stale splitting status when meta lock expired", () => {
    const stale = reconcileStaleOutfitSplitState({
      status: "splitting",
      sceneList: [],
      meta: { splitInProgressAt: Date.now() - 20 * 60_000, splitProgress: { label: "x" } },
    });
    expect(stale.dirty).toBe(true);
    expect(stale.status).toBe("draft");
    expect(stale.meta?.splitInProgressAt).toBeNull();
    expect(stale.meta?.splitProgress).toBeUndefined();
  });

  it("keeps active split untouched", () => {
    const active = reconcileStaleOutfitSplitState({
      status: "splitting",
      sceneList: [],
      meta: { splitInProgressAt: Date.now() - 1000 },
    });
    expect(active.dirty).toBe(false);
  });
});
