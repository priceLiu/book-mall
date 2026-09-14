import { describe, expect, it } from "vitest";

import { batchConnectSelectionScreenBox } from "@/lib/canvas/batch-connect-preview-anchors";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("batchConnectSelectionScreenBox", () => {
  const nodes: CanvasFlowNode[] = [
    {
      id: "a",
      type: "story-pro2-image",
      position: { x: 900, y: 100 },
      data: {},
      width: 240,
      height: 320,
    },
    {
      id: "b",
      type: "story-pro2-image",
      position: { x: 1180, y: 100 },
      data: {},
      width: 240,
      height: 320,
    },
  ];

  it("merges two flow-space nodes into one screen bbox", () => {
    const box = batchConnectSelectionScreenBox(
      ["a", "b"],
      nodes,
      ({ x, y }) => ({ x, y }),
      (id) =>
        ({
          internals: {
            positionAbsolute:
              id === "a" ? { x: 900, y: 100 } : { x: 1180, y: 100 },
          },
          measured: { width: 240, height: 320 },
          width: 240,
          height: 320,
        }) as never,
    );

    expect(box).toEqual({
      left: 900,
      top: 100,
      right: 1420,
      bottom: 420,
      midY: 260,
      width: 520,
      height: 320,
    });
  });
});
