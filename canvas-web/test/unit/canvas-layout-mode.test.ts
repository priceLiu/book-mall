import { describe, expect, it } from "vitest";
import { resolveCanvasLayoutShell } from "@/lib/canvas/canvas-layout-mode";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function node(type: string, id = type): CanvasFlowNode {
  return {
    id,
    type: type as CanvasFlowNode["type"],
    position: { x: 0, y: 0 },
    data: {},
  };
}

describe("resolveCanvasLayoutShell", () => {
  it("uses pro2 shell for pro2 media groups without starter pipeline", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "g1",
        type: "group",
        position: { x: 0, y: 0 },
        data: { pro2Kind: "frame-board", label: "分镜图" },
      },
      node("story-pro2-image", "img1"),
    ];
    expect(
      resolveCanvasLayoutShell({
        projectEdition: "standard",
        nodes,
        graphMeta: null,
      }),
    ).toBe("pro2");
  });

  it("uses pro2 shell when graph meta marks collaboration", () => {
    expect(
      resolveCanvasLayoutShell({
        projectEdition: "standard",
        nodes: [],
        graphMeta: { crewBulletinAnchor: { crewBulletin: { tasks: [] } } },
      }),
    ).toBe("pro2");
  });

  it("uses sbv1 shell for sbv1-only graphs", () => {
    expect(
      resolveCanvasLayoutShell({
        projectEdition: "sbv1",
        nodes: [node("sbv1-image"), node("sbv1-video-engine", "v1")],
        graphMeta: null,
      }),
    ).toBe("sbv1");
  });
});
