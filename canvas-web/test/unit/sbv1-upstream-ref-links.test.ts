import { describe, expect, it } from "vitest";
import { buildSbv1VideoEngineDockMentionables } from "@/lib/canvas/sbv1-dock-mentionables";
import { mentionPreviewShouldUseVideo } from "@/lib/canvas/mention-preview-media";
import {
  edgeMatchesSbv1VideoRefInput,
  resolveSbv1UpstreamMotionVideoLinks,
  resolveSbv1UpstreamRefLinks,
} from "@/lib/canvas/sbv1-upstream-ref-links";
import type { Sbv1UpstreamRefLink } from "@/lib/canvas/sbv1-upstream-ref-links";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function imageNode(id: string, ossUrl: string): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-image",
    position: { x: 0, y: 0 },
    data: { ossUrl, label: "分镜" },
  };
}

describe("edgeMatchesSbv1VideoRefInput", () => {
  const engineId = "v1";
  const imgId = "i1";
  const nodes = [imageNode(imgId, "https://cdn.example/a.jpg")];

  it("accepts in_ref", () => {
    const edge: CanvasFlowEdge = {
      id: "e1",
      source: imgId,
      target: engineId,
      targetHandle: "in_ref",
    };
    expect(edgeMatchesSbv1VideoRefInput(edge, engineId, nodes)).toBe(true);
  });

  it("accepts legacy in_text from image upstream", () => {
    const edge: CanvasFlowEdge = {
      id: "e2",
      source: imgId,
      target: engineId,
      targetHandle: "in_text",
    };
    expect(edgeMatchesSbv1VideoRefInput(edge, engineId, nodes)).toBe(true);
  });

  it("rejects in_text from text upstream", () => {
    const textNode: CanvasFlowNode = {
      id: "t1",
      type: "story-pro2-starter",
      position: { x: 0, y: 0 },
      data: { themeInput: "hello" },
    };
    const edge: CanvasFlowEdge = {
      id: "e3",
      source: "t1",
      target: engineId,
      targetHandle: "in_text",
    };
    expect(
      edgeMatchesSbv1VideoRefInput(edge, engineId, [...nodes, textNode]),
    ).toBe(false);
  });
});

describe("resolveSbv1UpstreamRefLinks", () => {
  it("resolves preview from runtime ossUrl", () => {
    const imgId = "i1";
    const engineId = "v1";
    const nodes: CanvasFlowNode[] = [
      {
        id: imgId,
        type: "sbv1-image",
        position: { x: 0, y: 0 },
        data: {
          runtime: { ossUrl: "https://cdn.example/runtime.jpg", status: "done" },
        },
      },
      {
        id: engineId,
        type: "sbv1-video-engine",
        position: { x: 200, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: imgId,
        target: engineId,
        targetHandle: "in_text",
      },
    ];
    const links = resolveSbv1UpstreamRefLinks(engineId, nodes, edges);
    expect(links).toHaveLength(1);
    expect(links[0]?.previewUrl).toBe("https://cdn.example/runtime.jpg");
  });
});

describe("resolveSbv1UpstreamMotionVideoLinks", () => {
  it("resolves upstream video on in_motion_video for regular video engine", () => {
    const srcId = "v-src";
    const dstId = "v-dst";
    const nodes: CanvasFlowNode[] = [
      {
        id: srcId,
        type: "sbv1-video-engine",
        position: { x: 0, y: 0 },
        data: {
          label: "拖入的视频",
          runtime: {
            status: "done",
            ossUrl: "https://cdn.example/upstream.mp4",
            posterUrl: "https://cdn.example/upstream-poster.jpg",
          },
        },
      },
      {
        id: dstId,
        type: "sbv1-video-engine",
        position: { x: 240, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e-motion",
        source: srcId,
        target: dstId,
        sourceHandle: "out_video",
        targetHandle: "in_motion_video",
      },
    ];
    const links = resolveSbv1UpstreamMotionVideoLinks(dstId, nodes, edges);
    expect(links).toHaveLength(1);
    expect(links[0]?.label).toBe("拖入的视频");
    expect(links[0]?.previewUrl).toBe("https://cdn.example/upstream-poster.jpg");
  });

  it("falls back to blob ephemeralUrl for local upload", () => {
    const srcId = "v-src";
    const dstId = "v-dst";
    const blob = "blob:http://localhost/abc";
    const nodes: CanvasFlowNode[] = [
      {
        id: srcId,
        type: "sbv1-video-engine",
        position: { x: 0, y: 0 },
        data: { runtime: { ephemeralUrl: blob } },
      },
      {
        id: dstId,
        type: "sbv1-video-engine",
        position: { x: 240, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e-motion",
        source: srcId,
        target: dstId,
        sourceHandle: "out_video",
        targetHandle: "in_motion_video",
      },
    ];
    const links = resolveSbv1UpstreamMotionVideoLinks(dstId, nodes, edges);
    expect(links[0]?.previewUrl).toBe(blob);
  });
});

describe("buildSbv1VideoEngineDockMentionables", () => {
  it("includes upstream motion video with video kind for @ picker", () => {
    const motion: Sbv1UpstreamRefLink[] = [
      {
        id: "sbv1-motion-v-src",
        index: 1,
        label: "拖入的视频",
        previewUrl: "https://cdn.example/upstream.mp4",
        sourceNodeId: "v-src",
        edgeId: "e1",
      },
    ];
    const items = buildSbv1VideoEngineDockMentionables(
      [],
      [],
      [],
      undefined,
      undefined,
      motion,
    );
    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("video");
    expect(mentionPreviewShouldUseVideo(items[0]!)).toBe(true);
  });
});

describe("mentionPreviewShouldUseVideo", () => {
  it("uses img for poster jpg on video refs", () => {
    expect(
      mentionPreviewShouldUseVideo({
        kind: "video",
        previewUrl: "https://cdn.example/poster.jpg",
      }),
    ).toBe(false);
  });
});
