import { describe, expect, it } from "vitest";
import { resolveSbv1VideoEngineInputs } from "@/lib/canvas/resolve-sbv1-video-engine-inputs";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

const SEEDANCE_MODEL = "doubao-seedance-2.0";

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
  it("Seedance: uses asset:// for imported upstream images", () => {
    const { nodes, edges } = makeNodes();
    const onlyImported: CanvasFlowEdge[] = [
      { id: "e1", source: "img1", target: "vid1", targetHandle: "in_ref" },
    ];
    const result = resolveSbv1VideoEngineInputs(nodes, onlyImported, "vid1", {
      referenceMode: "omni",
      modelKey: SEEDANCE_MODEL,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imageInputs).toEqual([]);
    expect(result.portraitAssetRefs).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
    ]);
  });

  it("Seedance: passes OSS for non-imported alongside asset refs", () => {
    const { nodes, edges } = makeNodes();
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      prompt: "walk",
      referenceMode: "omni",
      modelKey: SEEDANCE_MODEL,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portraitAssetRefs).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
    ]);
    expect(result.imageInputs).toEqual(["https://example.com/scene-b.png"]);
  });

  it("non-Seedance: always uses OSS even when portrait-imported", () => {
    const { nodes, edges } = makeNodes();
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "omni",
      modelKey: "wan2.7-r2v",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portraitAssetRefs).toEqual([]);
    expect(result.imageInputs).toEqual([
      "https://example.com/face-a.png",
      "https://example.com/scene-b.png",
    ]);
  });

  it("Seedance: accepts active portrait from assetId when assetUri missing", () => {
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
      modelKey: SEEDANCE_MODEL,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.portraitAssetRefs).toEqual([
      { url: "asset://asset-a", role: "reference_image" },
      { url: "asset://asset-b", role: "reference_image" },
    ]);
    expect(result.imageInputs).toEqual([]);
  });

  it("Seedance: maps first_last roles onto asset refs and OSS tail frame", () => {
    const { nodes, edges } = makeNodes();
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "first_last",
      modelKey: SEEDANCE_MODEL,
    });
    expect(result).toEqual({
      ok: true,
      imageInputs: ["https://example.com/scene-b.png"],
      portraitAssetRefs: [
        { url: "asset://asset-a", role: "first_frame" },
      ],
      videoInputs: [],
    });
  });

  it("Seedance: maps first_last with both assets", () => {
    const { nodes, edges } = makeNodes();
    nodes[1]!.data = {
      ossUrl: "https://example.com/face-b.png",
      portraitStatus: "active",
      portraitAssetUri: "asset://asset-b",
    };
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "first_last",
      modelKey: SEEDANCE_MODEL,
    });
    expect(result).toEqual({
      ok: true,
      imageInputs: [],
      portraitAssetRefs: [
        { url: "asset://asset-a", role: "first_frame" },
        { url: "asset://asset-b", role: "last_frame" },
      ],
      videoInputs: [],
    });
  });

  it("non-Seedance omni sends all connected OSS refs even when prompt @-mentions one", () => {
    const { nodes, edges } = makeNodes();
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      prompt: "scene with @<sbv1-ref-img1> only",
      referenceMode: "omni",
      modelKey: "happyhorse-1.0-r2v",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.imageInputs).toEqual([
      "https://example.com/face-a.png",
      "https://example.com/scene-b.png",
    ]);
  });

  it("non-Seedance fails when portrait-imported nodes lack HTTPS OSS", () => {
    const { nodes, edges } = makeNodes();
    nodes[0]!.data = {
      portraitStatus: "active",
      portraitAssetUri: "asset://asset-a",
    };
    nodes[1]!.data = {
      portraitStatus: "active",
      portraitAssetUri: "asset://asset-b",
    };
    const result = resolveSbv1VideoEngineInputs(nodes, edges, "vid1", {
      referenceMode: "omni",
      modelKey: "happyhorse-1.0-r2v",
    });
    expect(result).toEqual({
      ok: false,
      error:
        "请确认上游图片已生成完成并上传 OSS 后再生成视频（非 Seedance 模型直接使用 OSS 参考图，无需入库）。",
    });
  });
});
