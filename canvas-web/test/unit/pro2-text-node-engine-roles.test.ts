import { describe, expect, it } from "vitest";
import {
  pro2TextNodeLlmNeedsVision,
  resolvePro2TextNodeEngineRoles,
} from "@/lib/canvas/pro2-text-node-engine-roles";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("resolvePro2TextNodeEngineRoles", () => {
  it("image-to-prompt preset shows LLM only (not IMAGE)", () => {
    const roles = resolvePro2TextNodeEngineRoles({
      pro2TextPurpose: "general",
      pro2PresetKind: "image-to-prompt",
    });
    expect(roles).toEqual(["LLM"]);
  });

  it("video-to-prompt preset shows LLM only", () => {
    const roles = resolvePro2TextNodeEngineRoles({
      pro2TextPurpose: "general",
      pro2PresetKind: "video-to-prompt",
    });
    expect(roles).toEqual(["LLM"]);
  });

  it("text-to-video preset still shows VIDEO", () => {
    const roles = resolvePro2TextNodeEngineRoles({
      pro2TextPurpose: "general",
      pro2PresetKind: "text-to-video",
    });
    expect(roles).toEqual(["VIDEO"]);
  });

  it("image-to-prompt with inbound image needs vision LLM", () => {
    expect(
      pro2TextNodeLlmNeedsVision({
        pro2PresetKind: "image-to-prompt",
      }),
    ).toBe(true);
  });

  it("general write mode stays LLM only even when linked to image", () => {
    const textId = "text-1";
    const imageId = "img-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: textId,
        type: "story-pro2-starter",
        position: { x: 0, y: 0 },
        data: { pro2TextPurpose: "general" },
      },
      {
        id: imageId,
        type: "story-pro2-image",
        position: { x: 0, y: 0 },
        data: {},
      },
    ];
    const edges: CanvasFlowEdge[] = [
      { id: "e1", source: imageId, target: textId },
    ];
    const roles = resolvePro2TextNodeEngineRoles(
      { pro2TextPurpose: "general" },
      { nodeId: textId, nodes, edges },
    );
    expect(roles).toEqual(["LLM"]);
  });
});
