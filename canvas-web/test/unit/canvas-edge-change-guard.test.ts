import type { EdgeChange } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { filterSpuriousRfEdgeRemoves } from "@/lib/canvas/canvas-edge-change-guard";

describe("filterSpuriousRfEdgeRemoves", () => {
  const nodes = [
    { id: "a", type: "story-pro2-image", position: { x: 0, y: 0 }, data: {} },
    { id: "b", type: "sbv1-video-engine", position: { x: 400, y: 0 }, data: {} },
  ];
  const edges = [
    { id: "e1", source: "a", target: "b", targetHandle: "in_ref" },
  ];

  it("blocks remove when both endpoints still exist", () => {
    const changes: EdgeChange[] = [{ type: "remove", id: "e1" }];
    const out = filterSpuriousRfEdgeRemoves(changes, edges, nodes);
    expect(out.blockedRemoves).toBe(true);
    expect(out.changes).toEqual([]);
  });

  it("allows remove when source node was deleted", () => {
    const changes: EdgeChange[] = [{ type: "remove", id: "e1" }];
    const out = filterSpuriousRfEdgeRemoves(changes, edges, [nodes[1]!]);
    expect(out.blockedRemoves).toBe(false);
    expect(out.changes).toEqual(changes);
  });
});
