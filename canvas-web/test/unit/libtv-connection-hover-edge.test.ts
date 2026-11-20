import { describe, expect, it } from "vitest";
import { resolveConnectDragHoverEdge } from "@/lib/canvas/libtv-connection-snap";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const node: CanvasFlowNode = {
  id: "n1",
  type: "story-pro2-image",
  position: { x: 100, y: 100 },
  data: {},
  measured: { width: 200, height: 120 },
};

describe("resolveConnectDragHoverEdge", () => {
  it("source drag targets left edge (downstream in)", () => {
    expect(
      resolveConnectDragHoverEdge([node], { x: 150, y: 160 }, "image", "n1"),
    ).toBe("left");
  });

  it("target drag targets right edge (upstream out)", () => {
    expect(
      resolveConnectDragHoverEdge(
        [node],
        { x: 150, y: 160 },
        "in_image",
        "n1",
      ),
    ).toBe("right");
  });
});