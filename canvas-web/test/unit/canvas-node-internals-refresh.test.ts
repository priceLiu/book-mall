import { describe, expect, it } from "vitest";

import { collectNodeInternalsRefreshIds } from "@/lib/canvas/canvas-node-internals-refresh";

describe("collectNodeInternalsRefreshIds", () => {
  const img = {
    id: "img1",
    type: "sbv1-image",
    position: { x: 0, y: 0 },
    width: 320,
    height: 480,
  };
  const vid = {
    id: "vid1",
    type: "sbv1-video-engine",
    position: { x: 400, y: 0 },
    width: 640,
    height: 480,
  };
  const edge = {
    id: "e1",
    source: "img1",
    target: "vid1",
    targetHandle: "in_ref",
  };

  it("includes edge counterpart when video node resizes after generation", () => {
    const next = [{ ...img }, { ...vid, width: 720, height: 540 }];
    const ids = collectNodeInternalsRefreshIds([img, vid], next, [edge]);
    expect(ids.sort()).toEqual(["img1", "vid1"]);
  });

  it("returns empty when layout unchanged", () => {
    expect(collectNodeInternalsRefreshIds([img, vid], [img, vid], [edge])).toEqual(
      [],
    );
  });
});
