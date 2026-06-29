import { describe, expect, it } from "vitest";
import { submitCrewBulletinTaskFromNode } from "@/lib/canvas/crew-bulletin-node-submit";
import type { CrewBulletinAnchor } from "@/lib/canvas/crew-bulletin-context";
import type { CrewBulletinState } from "@/lib/canvas/crew-bulletin-types";
import type { CanvasFlowNode } from "@/lib/canvas/types";

function bulletin(): CrewBulletinState {
  return {
    publishedAt: new Date().toISOString(),
    hubNodeId: "hub-1",
    scriptTitle: "测试",
    totalEpisodes: 1,
    tasks: [
      {
        id: "character:a",
        kind: "character",
        rowKey: "a",
        label: "小明",
        status: "claimed",
        canvasNodeId: "node-canonical",
        assigneeDisplayName: "我",
      },
    ],
  };
}

function makeAnchor(b: CrewBulletinState): CrewBulletinAnchor {
  return {
    mode: "linked-package",
    anchorStorage: "graph-meta",
    nodeId: "crew-bulletin-meta",
    published: true,
    bulletin: b,
    hubFields: {} as CrewBulletinAnchor["hubFields"],
  };
}

describe("submitCrewBulletinTaskFromNode", () => {
  it("canonical node submit sets task done (overwrite)", () => {
    let b = bulletin();
    const nodes: CanvasFlowNode[] = [
      {
        id: "node-canonical",
        type: "story-pro2-three-view",
        position: { x: 0, y: 0 },
        data: {
          crewTaskId: "character:a",
          ossUrl: "https://example.com/a.png",
        },
      },
    ];
    const store = {
      nodes,
      edges: [],
      addNode: () => "",
      setNodes: (fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => {
        store.nodes = fn(store.nodes);
      },
      setEdges: () => {},
      updateNodeData: () => {},
      patchGraphMeta: (updater: (meta: { crewBulletinAnchor?: { crewBulletin?: CrewBulletinState } } | null) => unknown) => {
        const next = updater({
          crewBulletinAnchor: { crewBulletin: b },
        }) as { crewBulletinAnchor?: { crewBulletin?: CrewBulletinState } };
        if (next?.crewBulletinAnchor?.crewBulletin) {
          b = next.crewBulletinAnchor.crewBulletin;
        }
      },
    };
    const ok = submitCrewBulletinTaskFromNode(
      makeAnchor(b),
      b,
      "node-canonical",
      nodes,
      store,
    );
    expect(ok).toBe(true);
    expect(b.tasks[0]?.status).toBe("done");
    expect(b.tasks[0]?.completedAt).toBeTruthy();
  });

  it("fork node submit appends forkSubmissions without changing task status", () => {
    let b = bulletin();
    b.tasks[0]!.status = "done";
    b.tasks[0]!.completedAt = "2026-01-01T00:00:00.000Z";
    const nodes: CanvasFlowNode[] = [
      {
        id: "node-fork",
        type: "story-pro2-three-view",
        position: { x: 100, y: 0 },
        data: {
          crewTaskId: "character:a",
          crewTaskFork: true,
          crewTaskForkedFromNodeId: "node-canonical",
          ossUrl: "https://example.com/b.png",
        },
      },
    ];
    const store = {
      nodes,
      edges: [],
      addNode: () => "",
      setNodes: (fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => {
        store.nodes = fn(store.nodes);
      },
      setEdges: () => {},
      updateNodeData: () => {},
      patchGraphMeta: (updater: (meta: { crewBulletinAnchor?: { crewBulletin?: CrewBulletinState } } | null) => unknown) => {
        const next = updater({
          crewBulletinAnchor: { crewBulletin: b },
        }) as { crewBulletinAnchor?: { crewBulletin?: CrewBulletinState } };
        if (next?.crewBulletinAnchor?.crewBulletin) {
          b = next.crewBulletinAnchor.crewBulletin;
        }
      },
    };
    const ok = submitCrewBulletinTaskFromNode(
      makeAnchor(b),
      b,
      "node-fork",
      nodes,
      store,
    );
    expect(ok).toBe(true);
    expect(b.tasks[0]?.status).toBe("done");
    expect(b.tasks[0]?.completedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(b.tasks[0]?.forkSubmissions).toHaveLength(1);
    expect(b.tasks[0]?.forkSubmissions?.[0]?.nodeId).toBe("node-fork");
  });
});
