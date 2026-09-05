import { describe, expect, it } from "vitest";

import {
  applyPro2StarterUnlinkAfterEdgeRemoval,
  mergePro2CategoryStarterPatch,
  patchPro2StarterOnScriptHubLink,
  patchPro2StarterOnScriptHubUnlink,
  findPro2StartersLinkedToHub,
} from "@/lib/canvas/pro2-text-hub-link-sync";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

describe("patchPro2StarterOnScriptHubLink", () => {
  it("sets story-outline and default label when label empty", () => {
    expect(
      patchPro2StarterOnScriptHubLink({ pro2TextPurpose: "general" }, "hub-1"),
    ).toEqual({
      pro2TextPurpose: "story-outline",
      label: "故事大纲",
      workspaceIds: { scriptHubId: "hub-1" },
    });
  });

  it("keeps custom label when user renamed the node", () => {
    expect(
      patchPro2StarterOnScriptHubLink(
        { label: "我的创意", pro2TextPurpose: "general" },
        "hub-1",
      ),
    ).toEqual({
      pro2TextPurpose: "story-outline",
      workspaceIds: { scriptHubId: "hub-1" },
    });
  });
});

describe("patchPro2StarterOnScriptHubUnlink", () => {
  it("clears auto label and reverts purpose", () => {
    expect(
      patchPro2StarterOnScriptHubUnlink({
        label: "故事大纲",
        pro2TextPurpose: "story-outline",
        workspaceIds: { scriptHubId: "hub-1", styleHubId: "style-1" },
      }),
    ).toEqual({
      pro2TextPurpose: "general",
      label: undefined,
      workspaceIds: { styleHubId: "style-1" },
    });
  });

  it("clears label when purpose is story-outline even without stored label", () => {
    expect(
      patchPro2StarterOnScriptHubUnlink({
        pro2TextPurpose: "story-outline",
      }),
    ).toEqual({
      pro2TextPurpose: "general",
      label: undefined,
      workspaceIds: {},
    });
  });

  it("keeps custom label on unlink", () => {
    expect(
      patchPro2StarterOnScriptHubUnlink({
        label: "我的创意",
        pro2TextPurpose: "story-outline",
      }),
    ).toEqual({
      pro2TextPurpose: "general",
      workspaceIds: {},
    });
  });
});

describe("mergePro2CategoryStarterPatch", () => {
  it("preserves themeInput when switching category on existing starter", () => {
    const patch = mergePro2CategoryStarterPatch(
      { themeInput: "用户输入的主题", label: "故事大纲" },
      {
        label: "故事大纲",
        pro2TextPurpose: "story-outline",
        themeInput: "",
        generatedOutlineMd: "",
        themeOutlineSystemPrompt: "new-system",
      },
      { isNewSpawn: false },
    );
    expect(patch.themeInput).toBeUndefined();
    expect(patch.generatedOutlineMd).toBeUndefined();
    expect(patch.themeOutlineSystemPrompt).toBe("new-system");
    expect(patch.pro2TextPurpose).toBe("story-outline");
  });

  it("applies full starter patch for newly spawned starter", () => {
    const patch = mergePro2CategoryStarterPatch(
      undefined,
      {
        label: "故事大纲",
        themeInput: "",
        generatedOutlineMd: "",
      },
      { isNewSpawn: true },
    );
    expect(patch.themeInput).toBe("");
    expect(patch.generatedOutlineMd).toBe("");
  });
});

describe("findPro2StartersLinkedToHub", () => {
  it("finds starter via text edge", () => {
    const nodes = [
      { id: "hub", type: "story-pro2-script-hub", data: {} },
      { id: "s1", type: "story-pro2-starter", data: {} },
    ] as CanvasFlowNode[];
    const edges = [
      {
        id: "e1",
        source: "s1",
        target: "hub",
        sourceHandle: "text",
        targetHandle: "in_text",
      },
    ] as CanvasFlowEdge[];
    expect(findPro2StartersLinkedToHub("hub", nodes, edges)).toEqual(["s1"]);
  });
});

describe("applyPro2StarterUnlinkAfterEdgeRemoval", () => {
  it("reverts starter when edge removed via setEdges-style diff", () => {
    const nodes = [
      {
        id: "s1",
        type: "story-pro2-starter",
        data: {
          label: "故事大纲",
          pro2TextPurpose: "story-outline",
          workspaceIds: { scriptHubId: "hub" },
        },
      },
      { id: "hub", type: "story-pro2-script-hub", data: {} },
    ] as CanvasFlowNode[];
    const prevEdges = [
      { id: "e1", source: "s1", target: "hub" },
    ] as CanvasFlowEdge[];
    const nextEdges: CanvasFlowEdge[] = [];

    const next = applyPro2StarterUnlinkAfterEdgeRemoval(
      nodes,
      prevEdges,
      nextEdges,
    );
    expect(next[0]?.data).toMatchObject({
      pro2TextPurpose: "general",
      label: undefined,
    });
  });
});
