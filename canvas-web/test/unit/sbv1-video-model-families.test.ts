import { describe, expect, it } from "vitest";
import {
  buildSbv1VideoFamilyRouteSyncPatch,
  collapseSbv1DockVideoModelEntries,
  resolveSbv1VideoFamilyRouteModelKey,
  resolveSbv1VideoModelFamily,
} from "@/lib/canvas/sbv1-video-model-families";
import { getSbv1VideoDockModeChips } from "@/lib/canvas/sbv1-video-model-reference";

describe("sbv1-video-model-families", () => {
  it("collapses MiniMax H3 variants to one picker row", () => {
    const entries = [
      {
        providerId: "gateway:minimax-video",
        model: {
          id: "1",
          modelKey: "MiniMax/MiniMax-H3-t2v",
          displayName: "MiniMax H3 文生视频",
          role: "VIDEO",
          enabled: true,
          sortOrder: 1,
        },
      },
      {
        providerId: "gateway:minimax-video",
        model: {
          id: "2",
          modelKey: "MiniMax/MiniMax-H3-i2v",
          displayName: "MiniMax H3 图生视频",
          role: "VIDEO",
          enabled: true,
          sortOrder: 2,
        },
      },
    ] as Parameters<typeof collapseSbv1DockVideoModelEntries>[0];

    const collapsed = collapseSbv1DockVideoModelEntries(entries);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]?.model.displayName).toBe("MiniMax H3");
    expect(collapsed[0]?.model.modelKey).toBe("MiniMax/MiniMax-H3-t2v");
  });

  it("MiniMax H3 dock exposes unified mode chips", () => {
    const chips = getSbv1VideoDockModeChips("MiniMax/MiniMax-H3-i2v");
    expect(chips.map((c) => c.id)).toEqual([
      "t2v",
      "i2v",
      "first_last",
      "omni",
    ]);
  });

  it("routes family by dock input mode", () => {
    expect(
      resolveSbv1VideoFamilyRouteModelKey(
        "MiniMax/MiniMax-H3-t2v",
        "first_last",
      ),
    ).toBe("MiniMax/MiniMax-H3-fl2v");
    expect(
      resolveSbv1VideoFamilyRouteModelKey("happyhorse-1.1-t2v", "i2v"),
    ).toBe("happyhorse-1.1-i2v");
  });

  it("buildSbv1VideoFamilyRouteSyncPatch updates engine modelKey", () => {
    const patch = buildSbv1VideoFamilyRouteSyncPatch({
      engine: {
        providerId: "gateway:minimax-video",
        modelKey: "MiniMax/MiniMax-H3-t2v",
        params: {},
      },
      dockInputMode: "i2v",
      referenceMode: "omni",
    });
    expect(patch?.engine?.modelKey).toBe("MiniMax/MiniMax-H3-i2v");
    expect(resolveSbv1VideoModelFamily("MiniMax/MiniMax-H3-s2v")?.id).toBe(
      "minimax-h3",
    );
  });
});