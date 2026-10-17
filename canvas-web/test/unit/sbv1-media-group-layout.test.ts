import { describe, expect, it } from "vitest";

import { computeLibtvMediaAspectPresetSize } from "@/lib/canvas/libtv-media-aspect-preset";
import { applySbv1MediaGroupRelayout } from "@/lib/canvas/sbv1-media-group-layout";
import { isSbv1MediaGroup } from "@/lib/canvas/sbv1-media-group-meta";
import {
  resolveSbv1GroupMediaCellSize,
  resolveSbv1GroupVideoColumnSize,
} from "@/lib/canvas/sbv1-media-group-sizing";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const videoColumn9x16 = computeLibtvMediaAspectPresetSize("9:16", "sbv1-video");

describe("shortcut preset groups", () => {
  it("does not treat 文生视频 groups as sbv1 media groups or grid-relayout them", () => {
    const group = {
      id: "g1",
      type: "group",
      position: { x: 0, y: 0 },
      width: 1200,
      height: 700,
      data: { pro2ShortcutPreset: true, pro2Styled: true, label: "预设 - 文生视频" },
    } as CanvasFlowNode;
    const text = {
      id: "t1",
      type: "story-pro2-starter",
      parentId: "g1",
      position: { x: 28, y: 60 },
      width: 440,
      height: 360,
      data: {},
    } as CanvasFlowNode;
    const video = {
      id: "v1",
      type: "sbv1-video-engine",
      parentId: "g1",
      position: { x: 524, y: 60 },
      width: 630,
      height: 500,
      data: {},
    } as CanvasFlowNode;
    const nodes = [group, text, video];
    expect(isSbv1MediaGroup(group, nodes)).toBe(false);
    const next = applySbv1MediaGroupRelayout(nodes, [], "g1", { force: true });
    expect(next.find((n) => n.id === "t1")?.position).toEqual(text.position);
    expect(next.find((n) => n.id === "v1")?.position).toEqual(video.position);
  });
});

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
