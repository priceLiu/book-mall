import { describe, expect, it } from "vitest";
import {
  edgeMatchesSbv1VideoRefInput,
  resolveSbv1UpstreamRefLinks,
} from "@/lib/canvas/sbv1-upstream-ref-links";
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
