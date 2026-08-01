import { describe, expect, it } from "vitest";

import { resolveJianyingAutoRenderNodeSize } from "@/lib/canvas/jianying-auto-render-node-size";
import { SBV1_VIDEO_ENGINE_HEIGHT, SBV1_VIDEO_ENGINE_WIDTH } from "@/lib/canvas/sbv1-node-chrome";

describe("resolveJianyingAutoRenderNodeSize", () => {
  it("copies measured size from anchor video node", () => {
    const video = {
      id: "v1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: {},
      width: 420,
      height: 780,
    } as const;
    const size = resolveJianyingAutoRenderNodeSize({
      anchorNode: video as never,
      nodes: [video as never],
    });
    expect(size).toEqual({ width: 420, height: 780 });
  });

  it("uses largest connected video when anchor is export node", () => {
    const small = {
      id: "v1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: {},
      width: 380,
      height: 220,
    };
    const large = {
      id: "v2",
      type: "sbv1-video-engine",
      position: { x: 0, y: 200 },
      data: {},
      width: 635,
      height: 365,
    };
    const exportNode = {
      id: "ex",
      type: "jianying-export-pro2",
      position: { x: 700, y: 0 },
      data: {},
    };
    const size = resolveJianyingAutoRenderNodeSize({
      anchorNode: exportNode as never,
      nodes: [small, large, exportNode] as never[],
      edges: [
        { id: "e1", source: "v1", target: "ex", targetHandle: "in_video" },
        { id: "e2", source: "v2", target: "ex", targetHandle: "in_video" },
      ],
    });
    expect(size).toEqual({ width: 635, height: 365 });
  });

  it("falls back to sbv1 video default when no anchor", () => {
    expect(
      resolveJianyingAutoRenderNodeSize({
        nodes: [],
      }),
    ).toEqual({
      width: SBV1_VIDEO_ENGINE_WIDTH,
      height: SBV1_VIDEO_ENGINE_HEIGHT,
    });
  });
});
