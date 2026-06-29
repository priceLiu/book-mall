import { describe, expect, it } from "vitest";
import {
  pro2StarterCanSendGeneralText,
  pro2StarterHasUpstreamLlmImage,
} from "@/lib/canvas/pro2-starter-dock-send";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("pro2-starter-dock-send", () => {
  const textId = "text-1";
  const imageId = "img-1";
  const nodes: CanvasFlowNode[] = [
    {
      id: textId,
      type: "story-pro2-starter",
      position: { x: 0, y: 0 },
      data: { pro2PresetKind: "image-to-prompt" },
    },
    {
      id: imageId,
      type: "story-pro2-image",
      position: { x: 0, y: 0 },
      data: { ossUrl: "https://cdn.example/a.png" },
    },
  ];
  const edges: CanvasFlowEdge[] = [
    { id: "e1", source: imageId, target: textId },
  ];

  it("detects upstream https image", () => {
    expect(pro2StarterHasUpstreamLlmImage(textId, nodes, edges)).toBe(true);
  });

  it("allows send for image-to-prompt without dock text when image uploaded", () => {
    expect(
      pro2StarterCanSendGeneralText({
        themeInput: "",
        pro2PresetKind: "image-to-prompt",
        nodeId: textId,
        nodes,
        edges,
      }),
    ).toBe(true);
  });

  it("requires text for non-preset general nodes", () => {
    expect(
      pro2StarterCanSendGeneralText({
        themeInput: "",
        pro2PresetKind: undefined,
        nodeId: textId,
        nodes,
        edges,
      }),
    ).toBe(false);
  });
});
