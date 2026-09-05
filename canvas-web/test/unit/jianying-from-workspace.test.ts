import { describe, expect, it } from "vitest";

import {
  collectJianyingFramesForExportNode,
  collectJianyingFramesFromLibtvVideos,
  collectJianyingLibtvConnectionSnapshot,
  dialogueFromScriptHubByFrameIndex,
  mergeLibtvClipOrderNodeIds,
  moveClipOrderNodeIds,
  sortLibtvVideoNodesDefault,
} from "@/lib/canvas/jianying-from-workspace";
import { resolveLibtvAudioMixReadiness } from "@/lib/canvas/libtv-audio-export-url";
import {
  buildBatchConnectEdges,
  classifyBatchConnectMode,
  expandBatchSnapConnection,
} from "@/lib/canvas/pro2-batch-connect";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function videoNode(
  id: string,
  x: number,
  ossUrl?: string,
  prompt?: string,
  y = 0,
): CanvasFlowNode {
  return {
    id,
    type: "sbv1-video-engine",
    position: { x, y },
    data: {
      prompt,
      runtime: ossUrl ? { status: "done", ossUrl } : { status: "idle" },
    },
  };
}

describe("collectJianyingFramesFromLibtvVideos", () => {
  it("collects connected videos sorted by X and assigns frame indices", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-b", 200, "https://oss/b.mp4", "镜二"),
      videoNode("v-a", 100, "https://oss/a.mp4", "镜一"),
      { id: exportId, type: "jianying-export-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v-b",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
      {
        id: "e2",
        source: "v-a",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
    ];

    const frames = collectJianyingFramesFromLibtvVideos(exportId, nodes, edges);
    expect(frames).toHaveLength(2);
    expect(frames[0]?.frameIndex).toBe(1);
    expect(frames[0]?.videoUrl).toBe("https://oss/a.mp4");
    expect(frames[0]?.dialogue).toBe("镜一");
    expect(frames[1]?.frameIndex).toBe(2);
    expect(frames[1]?.videoUrl).toBe("https://oss/b.mp4");
  });

  it("falls back to script hub storyboard dialogue by clip sequence", () => {
    const exportId = "export-1";
    const storyboardMd = `| 镜号 | 对白 |
| --- | --- |
| 1 | 小红：你好 |
| 2 | 小蓝：再见 |`;
    const nodes: CanvasFlowNode[] = [
      videoNode("v1", 100, "https://oss/a.mp4"),
      videoNode("v2", 200, "https://oss/b.mp4"),
      {
        id: "hub",
        type: "story-pro2-script-hub",
        position: { x: 0, y: -200 },
        data: { storyboardMd },
      },
      { id: exportId, type: "jianying-export-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v1",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
      {
        id: "e2",
        source: "v2",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
    ];
    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.frames[0]?.dialogue).toBe("小红：你好");
    expect(snap.frames[1]?.dialogue).toBe("小蓝：再见");
    expect(dialogueFromScriptHubByFrameIndex(nodes, 2)).toBe("小蓝：再见");
  });

  it("resolves sbv1 upstream starter text as dialogue by clip sequence", () => {
    const exportId = "export-1";
    const storyboardMd = `| 镜号 | 对白 |
| --- | --- |
| 1 | 旁白：开场白 |
| 2 | 旁白：第二句 |`;
    const nodes: CanvasFlowNode[] = [
      videoNode("v1", 100, "https://oss/a.mp4"),
      videoNode("v2", 200, "https://oss/b.mp4"),
      {
        id: "starter-1",
        type: "story-pro2-starter",
        position: { x: -100, y: 0 },
        data: { dockInput: storyboardMd },
      },
      { id: exportId, type: "jianying-auto-render-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "text-v1",
        source: "starter-1",
        target: "v1",
        sourceHandle: "text",
        targetHandle: "in_text",
      },
      {
        id: "text-v2",
        source: "starter-1",
        target: "v2",
        sourceHandle: "text",
        targetHandle: "in_text",
      },
      {
        id: "e1",
        source: "v1",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
      {
        id: "e2",
        source: "v2",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.frames[0]?.dialogue).toBe("旁白：开场白");
    expect(snap.frames[1]?.dialogue).toBe("旁白：第二句");
  });

  it("prefers LibTV edges over workspace columns", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v1", 50, "https://oss/libtv.mp4"),
      { id: exportId, type: "jianying-export-pro2", position: { x: 300, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v1",
        target: exportId,
        targetHandle: "in_video",
      },
    ];

    const frames = collectJianyingFramesForExportNode(exportId, nodes, edges, {
      frameColumnId: "missing",
      videoColumnId: "missing",
    });
    expect(frames).toHaveLength(1);
    expect(frames[0]?.videoUrl).toBe("https://oss/libtv.mp4");
  });

  it("reports connected vs rendered counts", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-done", 100, "https://oss/a.mp4"),
      videoNode("v-pending", 200),
      { id: exportId, type: "jianying-export-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: "v-done",
        target: exportId,
        targetHandle: "in_video",
      },
      {
        id: "e2",
        source: "v-pending",
        target: exportId,
        targetHandle: "in_video",
      },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.connectedCount).toBe(2);
    expect(snap.renderedCount).toBe(1);
    expect(snap.frames).toHaveLength(1);
  });

  it("follows out_video chain before canvas position", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-a", 300, "https://oss/a.mp4", "A"),
      videoNode("v-b", 100, "https://oss/b.mp4", "B"),
      videoNode("v-c", 200, "https://oss/c.mp4", "C"),
      { id: exportId, type: "jianying-auto-render-pro2", position: { x: 500, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "chain-ab", source: "v-a", target: "v-b", sourceHandle: "out_video" },
      { id: "chain-bc", source: "v-b", target: "v-c", sourceHandle: "out_video" },
      { id: "e-a", source: "v-a", target: exportId, targetHandle: "in_video" },
      { id: "e-b", source: "v-b", target: exportId, targetHandle: "in_video" },
      { id: "e-c", source: "v-c", target: exportId, targetHandle: "in_video" },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.frames.map((f) => f.videoUrl)).toEqual([
      "https://oss/a.mp4",
      "https://oss/b.mp4",
      "https://oss/c.mp4",
    ]);
  });

  it("respects saved clip order overrides", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-a", 100, "https://oss/a.mp4"),
      videoNode("v-b", 200, "https://oss/b.mp4"),
      { id: exportId, type: "jianying-auto-render-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "e1", source: "v-a", target: exportId, targetHandle: "in_video" },
      { id: "e2", source: "v-b", target: exportId, targetHandle: "in_video" },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges, [
      "v-b",
      "v-a",
    ]);
    expect(snap.orderNodeIds).toEqual(["v-b", "v-a"]);
    expect(snap.frames[0]?.videoUrl).toBe("https://oss/b.mp4");
    expect(snap.frames[1]?.videoUrl).toBe("https://oss/a.mp4");
  });

  it("distinguishes local TTS preview from https export readiness", () => {
    expect(
      resolveLibtvAudioMixReadiness({
        ossUrl: "data:audio/mpeg;base64,abc",
        runtime: { ephemeralUrl: "data:audio/mpeg;base64,abc" },
      }),
    ).toEqual({ exportReady: false, localPreview: true });
  });

  it("uses runtime https oss when data ossUrl is local preview only", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-a", 100, "https://oss/a.mp4"),
      {
        id: "a-a",
        type: "story-pro2-audio",
        position: { x: 100, y: 120 },
        data: {
          ossUrl: "data:audio/mpeg;base64,abc",
          dockInput: "第一句对白",
          runtime: {
            status: "done",
            ossUrl: "https://oss/a.mp3",
            ephemeralUrl: "data:audio/mpeg;base64,abc",
          },
        },
      },
      { id: exportId, type: "jianying-auto-render-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "ev1", source: "v-a", target: exportId, targetHandle: "in_video" },
      { id: "ea1", source: "a-a", target: exportId, targetHandle: "in_audio" },
    ];
    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.audioRenderedCount).toBe(1);
    expect(snap.audioClipSlots[0]?.hasLocalPreview).toBe(true);
    expect(snap.frames[0]?.audioUrl).toBe("https://oss/a.mp3");
    expect(snap.frames[0]?.dialogue).toBe("第一句对白");
  });

  it("pairs audio clips with video frames by sequence index", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-a", 100, "https://oss/a.mp4"),
      {
        id: "a-a",
        type: "story-pro2-audio",
        position: { x: 100, y: 120 },
        data: { ossUrl: "https://oss/a.mp3", label: "配音A" },
      },
      videoNode("v-b", 200, "https://oss/b.mp4"),
      {
        id: "a-b",
        type: "story-pro2-audio",
        position: { x: 200, y: 120 },
        data: {
          runtime: { status: "done", ossUrl: "https://oss/b.mp3" },
        },
      },
      { id: exportId, type: "jianying-auto-render-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "ev1", source: "v-a", target: exportId, targetHandle: "in_video" },
      { id: "ev2", source: "v-b", target: exportId, targetHandle: "in_video" },
      { id: "ea1", source: "a-a", target: exportId, targetHandle: "in_audio" },
      { id: "ea2", source: "a-b", target: exportId, targetHandle: "in_audio" },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.audioConnectedCount).toBe(2);
    expect(snap.audioRenderedCount).toBe(2);
    expect(snap.frames).toHaveLength(2);
    expect(snap.frames[0]?.audioUrl).toBe("https://oss/a.mp3");
    expect(snap.frames[1]?.audioUrl).toBe("https://oss/b.mp3");
  });

  it("counts audio misconnected to in_video as配音", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      videoNode("v-a", 100, "https://oss/a.mp4"),
      {
        id: "a-a",
        type: "story-pro2-audio",
        position: { x: 100, y: 120 },
        data: { ossUrl: "https://oss/a.mp3", dockInput: "第一句对白" },
      },
      { id: exportId, type: "jianying-auto-render-pro2", position: { x: 400, y: 0 }, data: {} },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "ev1", source: "v-a", target: exportId, targetHandle: "in_video" },
      { id: "ea1", source: "a-a", target: exportId, targetHandle: "in_video" },
    ];

    const snap = collectJianyingLibtvConnectionSnapshot(exportId, nodes, edges);
    expect(snap.audioConnectedCount).toBe(1);
    expect(snap.audioClipSlots[0]?.label).toBe("第一句对白");
    expect(snap.frames[0]?.audioUrl).toBe("https://oss/a.mp3");
  });

  it("sorts by Y then X when no chain exists", () => {
    const nodes: CanvasFlowNode[] = [
      videoNode("bottom", 100, undefined, undefined, 200),
      videoNode("top", 300, undefined, undefined, 50),
    ];
    const sorted = sortLibtvVideoNodesDefault(nodes, nodes, []);
    expect(sorted.map((n) => n.id)).toEqual(["top", "bottom"]);
  });

  it("moveClipOrderNodeIds swaps adjacent ids", () => {
    expect(moveClipOrderNodeIds(["a", "b", "c"], "b", -1)).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(
      mergeLibtvClipOrderNodeIds(["c", "a"], nodesFromIds(["a", "b", "c"]), nodesFromIds(["a", "b", "c"]), []),
    ).toEqual(["c", "a", "b"]);
  });
});

function nodesFromIds(ids: string[]): CanvasFlowNode[] {
  return ids.map((id, i) => videoNode(id, i * 100, "https://oss/x.mp4"));
}

describe("pro2-batch-connect", () => {
  it("builds batch edges to export node", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      { id: "v1", type: "sbv1-video-engine", position: { x: 0, y: 0 }, data: {} },
      { id: "v2", type: "sbv1-video-engine", position: { x: 200, y: 0 }, data: {} },
      { id: exportId, type: "jianying-export-pro2", position: { x: 500, y: 0 }, data: {} },
    ];
    const edges = buildBatchConnectEdges(
      nodes.filter((n) => n.type === "sbv1-video-engine"),
      exportId,
      nodes,
      [],
    );
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.targetHandle === "in_video")).toBe(true);
  });

  it("classifies mixed media pipeline (three-view + prop + mood)", () => {
    const mixed: CanvasFlowNode[] = [
      { id: "i1", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
      { id: "tv", type: "story-pro2-three-view", position: { x: 100, y: 0 }, data: {} },
      { id: "p1", type: "story-pro2-prop", position: { x: 200, y: 0 }, data: {} },
    ];
    expect(classifyBatchConnectMode(mixed)).toBe("media-pipeline");
  });

  it("classifies mixed image + text as media pipeline", () => {
    const mixed: CanvasFlowNode[] = [
      { id: "i1", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
      { id: "t1", type: "story-pro2-starter", position: { x: 100, y: 0 }, data: {} },
    ];
    expect(classifyBatchConnectMode(mixed)).toBe("media-pipeline");
  });

  it("classifies text-only selection as media pipeline", () => {
    const texts: CanvasFlowNode[] = [
      { id: "t1", type: "story-pro2-starter", position: { x: 0, y: 0 }, data: {} },
      { id: "t2", type: "story-pro2-script-hub", position: { x: 100, y: 0 }, data: {} },
    ];
    expect(classifyBatchConnectMode(texts)).toBe("media-pipeline");
  });

  it("classifies image vs video batch modes", () => {
    const imgs: CanvasFlowNode[] = [
      { id: "i1", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
      { id: "i2", type: "story-pro2-image", position: { x: 100, y: 0 }, data: {} },
    ];
    const vids: CanvasFlowNode[] = [
      { id: "v1", type: "sbv1-video-engine", position: { x: 0, y: 0 }, data: {} },
      { id: "v2", type: "sbv1-video-engine", position: { x: 100, y: 0 }, data: {} },
    ];
    expect(classifyBatchConnectMode(imgs)).toBe("media-pipeline");
    expect(classifyBatchConnectMode(vids)).toBe("video-export");
    expect(classifyBatchConnectMode([...imgs, ...vids])).toBeNull();
  });

  it("builds per-source handles for mixed text + image to video engine", () => {
    const vidId = "vid-1";
    const nodes: CanvasFlowNode[] = [
      { id: "i1", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
      { id: "t1", type: "story-pro2-starter", position: { x: 200, y: 0 }, data: {} },
      { id: vidId, type: "sbv1-video-engine", position: { x: 500, y: 0 }, data: {} },
    ];
    const edges = buildBatchConnectEdges(
      nodes.filter((n) => n.id !== vidId),
      vidId,
      nodes,
      [],
    );
    expect(edges).toHaveLength(2);
    const imageEdge = edges.find((e) => e.source === "i1");
    const textEdge = edges.find((e) => e.source === "t1");
    expect(imageEdge?.targetHandle).toBe("in_ref");
    expect(textEdge?.targetHandle).toBe("in_text");
  });

  it("builds batch image edges to video engine in_ref", () => {
    const vidId = "vid-1";
    const nodes: CanvasFlowNode[] = [
      { id: "i1", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
      { id: "i2", type: "story-pro2-three-view", position: { x: 200, y: 0 }, data: {} },
      { id: vidId, type: "sbv1-video-engine", position: { x: 500, y: 0 }, data: {} },
    ];
    const edges = buildBatchConnectEdges(
      nodes.filter((n) => n.type !== "sbv1-video-engine"),
      vidId,
      nodes,
      [],
      "in_ref",
    );
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.targetHandle === "in_ref")).toBe(true);
    expect(edges.every((e) => e.sourceHandle === "image")).toBe(true);
  });

  it("builds batch image edges to image node in_image", () => {
    const targetId = "img-out";
    const nodes: CanvasFlowNode[] = [
      { id: "i1", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
      { id: "i2", type: "story-pro2-image", position: { x: 200, y: 0 }, data: {} },
      { id: targetId, type: "story-pro2-image", position: { x: 500, y: 0 }, data: {} },
    ];
    const edges = buildBatchConnectEdges(
      nodes.filter((n) => n.id !== targetId),
      targetId,
      nodes,
      [],
      "in_image",
    );
    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.targetHandle === "in_image")).toBe(true);
  });

  it("expandBatchSnapConnection fans out multi-select drag", () => {
    const exportId = "export-1";
    const nodes: CanvasFlowNode[] = [
      { id: "v1", type: "sbv1-video-engine", position: { x: 0, y: 0 }, data: {} },
      { id: "v2", type: "sbv1-video-engine", position: { x: 200, y: 0 }, data: {} },
      { id: exportId, type: "jianying-export-pro2", position: { x: 500, y: 0 }, data: {} },
    ];
    const batch = expandBatchSnapConnection(
      {
        source: "v1",
        target: exportId,
        sourceHandle: "out_video",
        targetHandle: "in_video",
      },
      ["v1", "v2"],
      nodes,
      [] as CanvasFlowEdge[],
    );
    expect(batch).toHaveLength(2);
  });
});
