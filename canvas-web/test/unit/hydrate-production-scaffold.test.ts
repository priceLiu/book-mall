import { describe, expect, it } from "vitest";
import PRO2_FIXTURE from "../fixtures/pro2-tang-dynasty-pack.json";
import { applyProductionScriptPatchToHub } from "@/lib/canvas/pro2-production-script-apply";
import {
  mountProductionScaffoldToCanvas,
  syncProductionScaffoldDataToHub,
} from "@/lib/canvas/hydrate-production-scaffold";
import { isPro2ProductionWizardHub } from "@/lib/canvas/pro2-production-wizard";
import type { StoryProScriptHubNodeData } from "@/lib/canvas/story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "@/lib/canvas/types";

const HUB_ID = "sp2-hub";

function emptyHub(): StoryProScriptHubNodeData {
  return {
    outlineMd: "",
    characterMd: "",
    sceneMd: "",
    storyboardMd: "",
    providerId: "",
    modelKey: "",
    promptOutline: "",
    promptCharacter: "",
    promptStoryboard: "",
  };
}

describe("production-scaffold", () => {
  it("isPro2ProductionWizardHub when productionScript has shots", () => {
    const hub = emptyHub();
    expect(isPro2ProductionWizardHub(hub)).toBe(false);
    hub.productionScript = {
      schemaVersion: 2,
      shots: [{ index: 1, sceneDescription: "test" }],
    };
    expect(isPro2ProductionWizardHub(hub)).toBe(true);
  });

  it("syncProductionScaffoldDataToHub writes rows only (no canvas nodes)", () => {
    const hubData = emptyHub();
    const patch = applyProductionScriptPatchToHub(
      hubData,
      PRO2_FIXTURE as never,
      HUB_ID,
    );
    const mergedHub = { ...hubData, ...patch } as StoryProScriptHubNodeData;
    const dataPatch = syncProductionScaffoldDataToHub(mergedHub, HUB_ID);
    expect(dataPatch?.productionWizardMode).toBe(true);
    expect(dataPatch?.scriptStudioFrameRows?.length).toBeGreaterThan(0);
    expect(dataPatch?.scriptStudioVideoRows?.every(
      (r) => r.ttsRuntime?.status === "idle",
    )).toBe(true);
  });

  it("mountProductionScaffoldToCanvas spawns columns without scene design column", () => {
    const hubData = emptyHub();
    const patch = applyProductionScriptPatchToHub(
      hubData,
      PRO2_FIXTURE as never,
      HUB_ID,
    );
    const mergedHub = {
      ...hubData,
      ...patch,
      ...syncProductionScaffoldDataToHub(
        { ...hubData, ...patch } as StoryProScriptHubNodeData,
        HUB_ID,
      ),
    } as StoryProScriptHubNodeData;

    const nodes: CanvasFlowNode[] = [
      {
        id: HUB_ID,
        type: "story-pro2-script-hub",
        position: { x: 0, y: 0 },
        data: mergedHub,
      },
    ];
    const edges: CanvasFlowEdge[] = [];
    const added: CanvasFlowNode[] = [];

    const addNode = (
      type: string,
      position: { x: number; y: number },
      data: Record<string, unknown>,
    ) => {
      const id = `${type}-${added.length + 1}`;
      added.push({
        id,
        type: type as CanvasFlowNode["type"],
        position,
        data,
      });
      return id;
    };

    const ws = mountProductionScaffoldToCanvas({
      scriptHubId: HUB_ID,
      hubData: mergedHub,
      nodes,
      edges,
      addNode,
      setEdges: () => {},
      updateNodeData: () => {},
    });

    expect(ws).not.toBeNull();
    expect(ws?.sceneColumnId).toBeUndefined();
    expect(added.some((n) => n.type === "story-pro2-scene")).toBe(false);
    expect(added.some((n) => n.type === "story-pro2-frame")).toBe(true);
    expect(added.some((n) => n.type === "story-pro2-video")).toBe(true);
  });

  it("mountProductionScaffoldToCanvas respawns columns when workspaceIds are stale", () => {
    const hubData = emptyHub();
    const patch = applyProductionScriptPatchToHub(
      hubData,
      PRO2_FIXTURE as never,
      HUB_ID,
    );
    const mergedHub = {
      ...hubData,
      ...patch,
      ...syncProductionScaffoldDataToHub(
        { ...hubData, ...patch } as StoryProScriptHubNodeData,
        HUB_ID,
      ),
    } as StoryProScriptHubNodeData;

    const STARTER_ID = "starter-1";
    const nodes: CanvasFlowNode[] = [
      {
        id: STARTER_ID,
        type: "story-pro2-starter",
        position: { x: 0, y: 0 },
        data: {
          workspaceIds: {
            scriptHubId: HUB_ID,
            characterColumnId: "deleted-char-col",
            frameColumnId: "deleted-frame-col",
            videoColumnId: "deleted-video-col",
          },
        },
      },
      {
        id: HUB_ID,
        type: "story-pro2-script-hub",
        position: { x: 400, y: 0 },
        data: mergedHub,
      },
    ];
    const edges: CanvasFlowEdge[] = [];
    const added: CanvasFlowNode[] = [];

    const addNode = (
      type: string,
      position: { x: number; y: number },
      data: Record<string, unknown>,
    ) => {
      const id = `${type}-${added.length + 1}`;
      added.push({
        id,
        type: type as CanvasFlowNode["type"],
        position,
        data,
      });
      return id;
    };

    const ws = mountProductionScaffoldToCanvas({
      scriptHubId: HUB_ID,
      hubData: mergedHub,
      nodes,
      edges,
      addNode,
      setEdges: () => {},
      updateNodeData: () => {},
    });

    expect(ws).not.toBeNull();
    expect(ws?.characterColumnId).not.toBe("deleted-char-col");
    expect(ws?.frameColumnId).not.toBe("deleted-frame-col");
    expect(ws?.videoColumnId).not.toBe("deleted-video-col");
    expect(added.some((n) => n.type === "story-pro2-character")).toBe(true);
    expect(added.some((n) => n.type === "story-pro2-frame")).toBe(true);
    expect(added.some((n) => n.type === "story-pro2-video")).toBe(true);
  });
});
