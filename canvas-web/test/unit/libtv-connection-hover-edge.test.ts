import { describe, expect, it } from "vitest";
import {
  resolveConnectDragHoverEdge,
  resolveConnectHandleDockEdge,
} from "@/lib/canvas/libtv-connection-snap";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const imageNode: CanvasFlowNode = {
  id: "img",
  type: "story-pro2-image",
  position: { x: 0, y: 0 },
  data: {},
  measured: { width: 200, height: 120 },
};

const videoNode: CanvasFlowNode = {
  id: "vid",
  type: "sbv1-video-engine",
  position: { x: 320, y: 0 },
  data: {},
  measured: { width: 220, height: 140 },
};

describe("resolveConnectHandleDockEdge", () => {
  it("in_* and plus_left snap to left border", () => {
    expect(resolveConnectHandleDockEdge("in_image", "story-pro2-image")).toBe(
      "left",
    );
    expect(resolveConnectHandleDockEdge("plus_left__in", "sbv1-image")).toBe(
      "left",
    );
  });

  it("outbound handles snap to right border", () => {
    expect(resolveConnectHandleDockEdge("image", "story-pro2-image")).toBe(
      "right",
    );
    expect(resolveConnectHandleDockEdge("out_video", "sbv1-video-engine")).toBe(
      "right",
    );
  });
});

describe("resolveConnectDragHoverEdge", () => {
  it("drag from right output to target uses left border on hover node", () => {
    expect(
      resolveConnectDragHoverEdge(
        [imageNode, videoNode],
        { x: 330, y: 70 },
        "img",
        "image",
        "vid",
      ),
    ).toBe("left");
  });

});