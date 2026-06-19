import { describe, expect, it } from "vitest";
import { resolveSbv1VideoEngineInputs } from "@/lib/canvas/resolve-sbv1-video-engine-inputs";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function makeNodes(): { nodes: CanvasFlowNode[]; edges: CanvasFlowEdge[] } {
  const nodes: CanvasFlowNode[] = [
    {
      id: "img1",
      type: "sbv1-image",
      position: { x: 0, y: 0 },
      data: {
        ossUrl: "https://example.com/face-a.png",
        portraitStatus: "active",
        portraitAssetUri: "asset://asset-a",
      },
    },
    {
      id: "img2",
      type: "sbv1-image",
      position: { x: 0, y: 0 },
      data: {
        ossUrl: "https://example.com/scene-b.png",
      },
    },
    {
      id: "vid1",
      type: "sbv1-video-engine",
      position: { x: 0, y: 0 },
      data: { prompt: "test", referenceMode: "omni" },
    },
  ];
  const edges: CanvasFlowEdge[] = [
    { id: "e1", source: "img1", target: "vid1", targetHandle: "in_ref" },
    { id: "e2", source: "img2", target: "vid1", targetHandle: "in_ref" },
  ];
  return { nodes, edges };
}

describe("resolveSbv1VideoEngineInputs", () => {
  it("uses asset:// only for imported upstream images", () => {
    const { nodes, edges } = makeNodes();
    const onlyImported: CanvasFlowEdge[] = [
      { id: "e1", source: "img1", target: "vid1", targetHandle: "in_ref" },
    ];
    const result = resolveSbv1VideoEngineInputs(nodes, onlyImported, "vid1", {
      referenceMode: "omni",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imageInputs).toEqual([]);
    expect(result.portraitAssetRefs).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
    ]);
  });

  it("passes OSS for non-imported upstream images alongside asset refs", () => {
    const { nodes, edges } = makeNodes();
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      prompt: "walk",
      referenceMode: "omni",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portraitAssetRefs).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
    ]);
    expect(result.imageInputs).toEqual(["https://example.com/scene-b.png"]);
  });

  it("accepts active portrait from assetId when assetUri missing", () => {
    const { nodes, edges } = makeNodes();
    nodes[0]!.data = {
      ossUrl: "https://example.com/face-a.png",
      portraitStatus: "active",
      portraitAssetId: "asset-a",
    };
    nodes[1]!.data = {
      ossUrl: "https://example.com/scene-b.png",
      portraitStatus: "active",
      portraitAssetUri: "asset://asset-b",
    };
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "omni",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portraitAssetRefs).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
      { url: "asset://asset-b", role: "reference_image" },
    ]);
    expect(result.imageInputs).toEqual([]);
  });

  it("maps first_last roles onto asset refs and OSS tail frame", () => {
    const { nodes, edges } = makeNodes();
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "first_last",
    });
    expect(result).toEqual({
      ok: true,
      imageInputs: ["https://example.com/scene-b.png"],
      portraitAssetRefs: [
        { url: "asset://asset-a", role: "first_frame" },
      ],
    });
  });

  it("maps first_last with both assets", () => {
    const { nodes, edges } = makeNodes();
    nodes[1]!.data = {
      ossUrl: "https://example.com/face-b.png",
      portraitStatus: "active",
      portraitAssetUri: "asset://asset-b",
    };
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "first_last",
    });
    expect(result).toEqual({
      ok: true,
      imageInputs: [],
      portraitAssetRefs: [
        { url: "asset://asset-a", role: "first_frame" },
        { url: "asset://asset-b", role: "last_frame" },
      ],
    });
  });
});
