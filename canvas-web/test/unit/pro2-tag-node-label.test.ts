import { describe, expect, it } from "vitest";

import { selectPro2TagNodeDefaultLabel } from "@/lib/canvas/pro2-tag-node-label";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function tag(id: string): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-tag",
    position: { x: 0, y: 0 },
    data: { body: "" },
  };
}

describe("pro2-tag-node-label", () => {
  it("returns ordinal among tag nodes only", () => {
    const nodes: CanvasFlowNode[] = [
      tag("t1"),
      { id: "x", type: "story-pro2-starter", position: { x: 0, y: 0 }, data: {} },
      tag("t2"),
    ];
    expect(selectPro2TagNodeDefaultLabel(nodes, "t1")).toBe("标签节点 1");
    expect(selectPro2TagNodeDefaultLabel(nodes, "t2")).toBe("标签节点 2");
  });
});
