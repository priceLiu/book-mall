import { describe, expect, it } from "vitest";
import { syncCrewBulletinFromCanvasNodes } from "@/lib/canvas/crew-bulletin-sync";
import type { CrewBulletinState } from "@/lib/canvas/crew-bulletin-types";
import type { CanvasFlowNode } from "@/lib/canvas/types";

describe("syncCrewBulletinFromCanvasNodes", () => {
  it("reverts generating to claimed when node is idle without output", () => {
    const bulletin: CrewBulletinState = {
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
          status: "generating",
          canvasNodeId: "node-1",
        },
      ],
    };
    const nodes: CanvasFlowNode[] = [
      {
        id: "node-1",
        type: "story-pro2-three-view",
        position: { x: 0, y: 0 },
        data: { label: "小明", runtime: { status: "idle" } },
      },
    ];
    const synced = syncCrewBulletinFromCanvasNodes(bulletin, nodes);
    expect(synced.tasks[0]?.status).toBe("claimed");
  });

  it("keeps claimed (not done) when generation finishes with output", () => {
    const bulletin: CrewBulletinState = {
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
          status: "generating",
          canvasNodeId: "node-1",
        },
      ],
    };
    const nodes: CanvasFlowNode[] = [
      {
        id: "node-1",
        type: "story-pro2-three-view",
        position: { x: 0, y: 0 },
        data: {
          label: "小明",
          ossUrl: "https://example.com/out.png",
          runtime: { status: "done" },
        },
      },
    ];
    const synced = syncCrewBulletinFromCanvasNodes(bulletin, nodes);
    expect(synced.tasks[0]?.status).toBe("claimed");
    expect(synced.tasks[0]?.completedAt).toBeUndefined();
  });
});
