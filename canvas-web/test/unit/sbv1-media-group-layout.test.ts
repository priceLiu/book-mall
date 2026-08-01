import { describe, expect, it } from "vitest";

import { computeLibtvMediaAspectPresetSize } from "@/lib/canvas/libtv-media-aspect-preset";
import {
  resolveSbv1GroupMediaCellSize,
  resolveSbv1GroupVideoColumnSize,
} from "@/lib/canvas/sbv1-media-group-sizing";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const videoColumn9x16 = computeLibtvMediaAspectPresetSize("9:16", "sbv1-video");

describe("resolveSbv1GroupVideoColumnSize", () => {
  it("uses canonical sbv1-video-engine box, ignores auto-render shrink", () => {
    const video = {
      id: "v1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: { aspectRatio: "9:16", mediaFit: true },
      width: videoColumn9x16.width,
      height: videoColumn9x16.height,
    } as CanvasFlowNode;
    const render = {
      id: "r1",
      type: "jianying-auto-render-pro2",
      position: { x: 0, y: 0 },
      data: { mediaFit: true },
      width: 635,
      height: 1167,
    } as CanvasFlowNode;
    const all = [video, render];

    expect(resolveSbv1GroupVideoColumnSize([video, render], all)).toEqual(
      videoColumn9x16,
    );
  });
});

describe("sbv1 group unified media sizing", () => {
  const videoColumn = videoColumn9x16;
  const allNodes = [
    {
      id: "g1",
      type: "group",
      position: { x: 0, y: 0 },
      data: { pro2Kind: "frame-board" },
    },
    {
      id: "v1",
      type: "sbv1-video-engine",
      parentId: "g1",
      position: { x: 0, y: 0 },
      data: { aspectRatio: "9:16" },
      width: videoColumn.width,
      height: videoColumn.height,
    },
  ] as CanvasFlowNode[];

  it("aligns story-pro2-image cell to video column", () => {
    const image = {
      id: "img1",
      type: "story-pro2-image",
      parentId: "g1",
      position: { x: 0, y: 0 },
      data: {
        aspectRatio: "9:16",
        mediaAspectPreset: "9:16",
        mediaFit: true,
        mediaFitKey: "aspect-preset|9:16|pro2-image",
      },
      width: 700,
      height: 1288,
    } as CanvasFlowNode;

    expect(
      resolveSbv1GroupMediaCellSize(image, [...allNodes, image], videoColumn),
    ).toEqual(videoColumn);
  });

  it("aligns auto-render slot to video column", () => {
    const render = {
      id: "r1",
      type: "jianying-auto-render-pro2",
      parentId: "g1",
      position: { x: 0, y: 0 },
      data: { mediaFit: true },
      width: 635,
      height: 1167,
    } as CanvasFlowNode;

    expect(
      resolveSbv1GroupMediaCellSize(render, [...allNodes, render], videoColumn),
    ).toEqual(videoColumn);
  });
});
