import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mountProductionVisualGroupsFromStore,
  resolveColumnIdFromHubGroup,
  resolveProductionWizardColumnIds,
} from "@/lib/canvas/pro2-production-wizard-canvas-mount";
import type { CanvasFlowNode } from "@/lib/canvas/types";
import { useCanvasStore } from "@/lib/canvas/store";
import type { Pro2ProductionScript } from "@/lib/canvas/data/pro2-production-script-schema";

vi.mock("@/lib/canvas/pro2-spawn-character-image-group", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/lib/canvas/pro2-spawn-character-image-group")
    >();
  return {
    ...actual,
    ensurePro2CharacterImageGroup: vi.fn(),
  };
});

vi.mock("@/lib/canvas/pro2-spawn-frame-image-group", () => ({
  ensurePro2FrameImageGroup: vi.fn(),
}));

vi.mock("@/lib/canvas/pro2-spawn-video-board-group", () => ({
  ensurePro2VideoBoardGroup: vi.fn(),
}));

vi.mock("@/lib/canvas/script-studio-media-spawn", () => ({
  spawnScriptStudioMediaCardsFromWorkspace: vi.fn(),
}));

const HUB_ID = "hub-1";

const productionScript: Pro2ProductionScript = {
  schemaVersion: 2,
  visualStyle: {
    worldBackground: "测试",
    era: "当代",
    pictureStyle: "二次元",
  },
  characters: [],
  scenes: [],
  shots: [{ index: 1, sceneDescription: "镜1", dialogue: "—" }],
};

describe("pro2-production-wizard-canvas-mount", () => {
  beforeEach(() => {
    useCanvasStore.setState({
      nodes: [
        {
          id: HUB_ID,
          type: "story-pro2-script-hub",
          position: { x: 0, y: 0 },
          data: {
            productionScript,
            scriptStudioCharacterRows: [{ key: "c1", name: "角色 A" }],
            scriptStudioFrameRows: [{ key: "1", shotIndex: 1 }],
          },
        },
      ] as ReturnType<typeof useCanvasStore.getState>["nodes"],
      edges: [],
    });
  });
  it("resolveProductionWizardColumnIds ignores stale workspace ids", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "char-col",
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: { hubNodeId: "hub-1" },
      },
    ];

    expect(
      resolveProductionWizardColumnIds(nodes, "hub-1", {
        scriptHubId: "hub-1",
        characterColumnId: "missing-char",
        frameColumnId: "missing-frame",
      }).characterColumnId,
    ).toBe("char-col");
  });

  it("resolveColumnIdFromHubGroup reads controller from hub media group", () => {
    const nodes: CanvasFlowNode[] = [
      {
        id: "char-col",
        type: "story-pro2-character",
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: "group-1",
        type: "group",
        position: { x: 0, y: 0 },
        data: {
          pro2Kind: "character-board",
          pro2HubNodeId: "hub-1",
          pro2ControllerNodeId: "char-col",
        },
      },
    ];

    expect(
      resolveColumnIdFromHubGroup(nodes, "hub-1", "character-board"),
    ).toBe("char-col");
    expect(
      resolveColumnIdFromHubGroup(nodes, "hub-1", "frame-board"),
    ).toBeUndefined();
  });

  it("mountProductionVisualGroupsFromStore falls back to hub rows when column has no rows", async () => {
    const { ensurePro2CharacterImageGroup } = await import(
      "@/lib/canvas/pro2-spawn-character-image-group"
    );

    useCanvasStore.setState((state) => ({
      ...state,
      nodes: [
        ...(state.nodes ?? []),
        {
          id: "char-col-live",
          type: "story-pro2-character",
          position: { x: 0, y: 0 },
          data: { hubNodeId: HUB_ID },
        },
        {
          id: "starter-1",
          type: "story-pro2-starter",
          position: { x: 0, y: 0 },
          data: {
            workspaceIds: {
              scriptHubId: HUB_ID,
              characterColumnId: "char-col-stale",
            },
          },
        },
      ] as ReturnType<typeof useCanvasStore.getState>["nodes"],
    }));

    expect(() => mountProductionVisualGroupsFromStore(HUB_ID)).not.toThrow();

    expect(ensurePro2CharacterImageGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        characterColumnId: "char-col-live",
        rows: [{ key: "c1", name: "角色 A" }],
      }),
    );
  });

  it("mountProductionVisualGroupsFromStore spawns video board when video column exists", async () => {
    const { ensurePro2VideoBoardGroup } = await import(
      "@/lib/canvas/pro2-spawn-video-board-group"
    );

    useCanvasStore.setState((state) => ({
      ...state,
      nodes: [
        ...(state.nodes ?? []),
        {
          id: "frame-col",
          type: "story-pro2-frame",
          position: { x: 0, y: 0 },
          data: { hubNodeId: HUB_ID },
        },
        {
          id: "video-col",
          type: "story-pro2-video",
          position: { x: 0, y: 0 },
          data: { hubNodeId: HUB_ID, frameColumnId: "frame-col" },
        },
        {
          id: "starter-1",
          type: "story-pro2-starter",
          position: { x: 0, y: 0 },
          data: {
            workspaceIds: {
              scriptHubId: HUB_ID,
              frameColumnId: "frame-col",
              videoColumnId: "video-col",
            },
          },
        },
      ] as ReturnType<typeof useCanvasStore.getState>["nodes"],
    }));

    mountProductionVisualGroupsFromStore(HUB_ID);

    expect(ensurePro2VideoBoardGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        videoColumnId: "video-col",
        frameColumnId: "frame-col",
      }),
    );
  });
});
