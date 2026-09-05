import { describe, expect, it } from "vitest";
import { listPro2WizardCanvasImagePicks } from "@/lib/canvas/pro2-wizard-canvas-image-picks";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("listPro2WizardCanvasImagePicks", () => {
  it("collects image urls from libtv nodes", () => {
    const nodes = [
      {
        id: "n1",
        type: "story-pro2-image",
        position: { x: 0, y: 0 },
        data: {
          label: "百官",
          runtime: { ossUrl: "https://cdn.example.com/a.png" },
        },
      },
      {
        id: "n2",
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: {},
      },
    ] as CanvasFlowNode[];

    expect(listPro2WizardCanvasImagePicks(nodes)).toEqual([
      {
        nodeId: "n1",
        label: "百官",
        url: "https://cdn.example.com/a.png",
        nodeType: "story-pro2-image",
      },
    ]);
  });
});
