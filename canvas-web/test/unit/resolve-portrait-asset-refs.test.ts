import { describe, expect, it } from "vitest";
import {
  dedupePortraitAssetRefs,
  reconcileVideoPortraitInputs,
  resolvePortraitAssetRefsFromUpstream,
} from "@/lib/canvas/resolve-portrait-asset-refs";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("resolvePortraitAssetRefsFromUpstream", () => {
  it("dedupes when multiple edges point to the same image node", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "img1",
        type: "sbv1-image",
        position: { x: 0, y: 0 },
        data: {
          ossUrl: "https://example.com/face.png",
          portraitStatus: "active",
          portraitAssetUri: "asset://asset-abc",
        },
      },
      {
        id: "vid1",
        type: "sbv1-video-engine",
        position: { x: 0, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "e1", source: "img1", target: "vid1" },
      { id: "e2", source: "img1", target: "vid1" },
      { id: "e3", source: "img1", target: "vid1" },
    ];
    expect(resolvePortraitAssetRefsFromUpstream(nodes, edges, "vid1")).toEqual([
      { url: "asset://asset-abc", role: "reference_image" },
    ]);
  });
});

describe("reconcileVideoPortraitInputs", () => {
  it("strips HTTPS oss for portrait-imported upstream images", () => {
    const oss = "https://example.com/face.png";
    const nodes: CanvasFlowNode[] = [
      {
        id: "img1",
        type: "sbv1-image",
        position: { x: 0, y: 0 },
        data: {
          ossUrl: oss,
          portraitStatus: "active",
          portraitAssetUri: "asset://asset-abc",
        },
      },
      {
        id: "img2",
        type: "sbv1-image",
        position: { x: 0, y: 0 },
        data: { ossUrl: "https://example.com/scene.png" },
      },
      {
        id: "vid1",
        type: "sbv1-video-engine",
        position: { x: 0, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "e1", source: "img1", target: "vid1" },
      { id: "e2", source: "img2", target: "vid1" },
    ];
    const portraitRefs = [{ url: "asset://asset-abc", role: "reference_image" as const }];
    const result = reconcileVideoPortraitInputs(
      nodes,
      edges,
      "vid1",
      [oss, "https://example.com/scene.png"],
      portraitRefs,
    );
    expect(result.imageInputs).toEqual(["https://example.com/scene.png"]);
    expect(result.portraitAssetRefs).toEqual(portraitRefs);
  });
});

describe("dedupePortraitAssetRefs", () => {
  it("keeps first occurrence only", () => {
    expect(
      dedupePortraitAssetRefs([
        { url: "asset://asset-a", role: "reference_image" },
        { url: "asset://asset-a", role: "reference_image" },
        { url: "asset://asset-b", role: "reference_image" },
      ]),
    ).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
      { url: "asset://asset-b", role: "reference_image" },
    ]);
  });
});
