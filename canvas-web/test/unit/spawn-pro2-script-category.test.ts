import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/canvas/pro2-spawn-select", () => ({
  selectPro2NodeAfterSpawn: vi.fn(),
}));

import { connectScriptHubEdge } from "@/lib/canvas/pro2-script-hub-connect";
import { applyPro2ScriptCategoryFromHub } from "@/lib/canvas/spawn-pro2-script-category-from-hub";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

function makeHub(id: string, x: number, y = 100): CanvasFlowNode {
  return {
    id,
    type: "story-pro2-script-hub",
    position: { x, y },
    data: {},
    width: 440,
  } as CanvasFlowNode;
}

describe("connectScriptHubEdge", () => {
  it("adds text → in_text edge", () => {
    let edges: CanvasFlowEdge[] = [];
    connectScriptHubEdge(
      (fn) => {
        edges = fn(edges);
      },
      "starter-1",
      "hub-1",
      "text",
      "in_text",
    );
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: "starter-1",
      target: "hub-1",
      sourceHandle: "text",
      targetHandle: "in_text",
    });
  });
});

describe("applyPro2ScriptCategoryFromHub", () => {
  it("spawns starter left of hub and connects text → in_text", () => {
    const hubId = "hub-1";
    let nodes: CanvasFlowNode[] = [makeHub(hubId, 500)];
    let edges: CanvasFlowEdge[] = [];
    let starterId = "";

    const addNode = vi.fn(
      (
        type: "story-pro2-starter",
        position: { x: number; y: number },
        data?: Record<string, unknown>,
      ) => {
        starterId = "starter-new";
        nodes = [
          ...nodes,
          {
            id: starterId,
            type,
            position,
            data: data ?? {},
          } as CanvasFlowNode,
        ];
        return starterId;
      },
    );

    const setEdges = vi.fn((fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => {
      edges = fn(edges);
    });
    const updateNodeData = vi.fn();
    const setNodes = vi.fn((fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => {
      nodes = fn(nodes);
    });

    const result = applyPro2ScriptCategoryFromHub(hubId, "gu-feng-tian-chong", {
      nodes,
      edges,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
    });

    expect(result?.spawnedStarter).toBe(true);
    expect(addNode).toHaveBeenCalledOnce();
    expect(addNode.mock.calls[0][1]).toEqual({ x: 12, y: 100 });

    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: "starter-new",
      target: hubId,
      sourceHandle: "text",
      targetHandle: "in_text",
    });

    expect(updateNodeData).toHaveBeenCalledWith(
      hubId,
      expect.objectContaining({
        scriptCategoryId: "gu-feng-tian-chong",
        scriptCategoryDocTitle: "古风甜宠短剧",
        dockInput: "",
      }),
    );
  });

  it("reuses existing upstream starter without spawning", () => {
    const hubId = "hub-1";
    const starterId = "starter-existing";
    const nodes: CanvasFlowNode[] = [
      makeHub(hubId, 500),
      {
        id: starterId,
        type: "story-pro2-starter",
        position: { x: 12, y: 100 },
        data: {
          workspaceIds: { scriptHubId: hubId },
          themeInput: "用户已填写的主题内容",
          label: "故事大纲",
        },
      } as CanvasFlowNode,
    ];
    const edges: CanvasFlowEdge[] = [
      {
        id: "e1",
        source: starterId,
        target: hubId,
        sourceHandle: "text",
        targetHandle: "in_text",
      } as CanvasFlowEdge,
    ];

    const addNode = vi.fn();
    const setEdges = vi.fn();
    const updateNodeData = vi.fn();
    const setNodes = vi.fn((fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => fn(nodes));

    const result = applyPro2ScriptCategoryFromHub(hubId, "default-master", {
      nodes,
      edges,
      addNode,
      setEdges,
      setNodes,
      updateNodeData,
    });

    expect(result?.spawnedStarter).toBe(false);
    expect(addNode).not.toHaveBeenCalled();
    expect(setEdges).not.toHaveBeenCalled();
    expect(updateNodeData).toHaveBeenCalledWith(
      hubId,
      expect.objectContaining({ scriptCategoryId: "default-master" }),
    );
    expect(updateNodeData).toHaveBeenCalledWith(
      starterId,
      expect.not.objectContaining({ themeInput: "" }),
    );
    const starterPatchCall = updateNodeData.mock.calls.find(
      (c) => c[0] === starterId,
    );
    expect(starterPatchCall?.[1]).not.toHaveProperty("themeInput");
  });
});
