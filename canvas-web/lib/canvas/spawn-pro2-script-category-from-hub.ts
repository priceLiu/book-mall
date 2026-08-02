import {
  pro2ScriptCategoryPreset,
  pro2ScriptCategoryStarterDefaults,
  type Pro2ScriptCategoryId,
} from "./pro2-script-category-presets";
import { buildPro2StarterNodeData } from "./pro2-starter-node-data";
import { connectScriptHubEdge } from "./pro2-script-hub-connect";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_TEXT_NODE_WIDTH } from "./story-pro2-node-chrome";
import { resolveStarterForHub } from "./story-workspace-resolver";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const SPAWN_GAP = 48;

export type ApplyPro2ScriptCategoryResult = {
  starterId: string;
  hubId: string;
  spawnedStarter: boolean;
};

type ApplyPro2ScriptCategoryStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: "story-pro2-starter",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

/** 方案 A：在当前 hub 左侧 spawn/绑定文本节点并应用剧本类别 preset */
export function applyPro2ScriptCategoryFromHub(
  hubId: string,
  categoryId: Pro2ScriptCategoryId,
  store: ApplyPro2ScriptCategoryStore,
): ApplyPro2ScriptCategoryResult | null {
  const preset = pro2ScriptCategoryPreset(categoryId);
  if (!preset) return null;

  const hub = store.nodes.find((n) => n.id === hubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return null;

  const textW = PRO2_TEXT_NODE_WIDTH;
  const y = hub.position.y;

  let starterId: string;
  let spawnedStarter = false;

  const linkedStarter = resolveStarterForHub(store.nodes, store.edges, hubId);
  if (linkedStarter) {
    starterId = linkedStarter.id;
  } else {
    const x = hub.position.x - textW - SPAWN_GAP;
    starterId = store.addNode(
      "story-pro2-starter",
      { x, y },
      buildPro2StarterNodeData({
        ...pro2ScriptCategoryStarterDefaults(),
        ...preset.starterPatch,
        workspaceIds: { scriptHubId: hubId },
      }),
    );
    if (!starterId) return null;
    connectScriptHubEdge(store.setEdges, starterId, hubId, "text", "in_text");
    spawnedStarter = true;
  }

  store.updateNodeData(starterId, {
    ...pro2ScriptCategoryStarterDefaults(
      linkedStarter?.data as Record<string, unknown>,
    ),
    ...preset.starterPatch,
    workspaceIds: { scriptHubId: hubId },
  });

  store.updateNodeData(hubId, {
    ...preset.hubPatch,
    scriptPromptViewId: undefined,
    providerId:
      (hub.data as { providerId?: string }).providerId ??
      pro2ScriptCategoryStarterDefaults().providerId,
    modelKey:
      (hub.data as { modelKey?: string }).modelKey ??
      pro2ScriptCategoryStarterDefaults().modelKey,
    params: {
      ...(pro2ScriptCategoryStarterDefaults(
        hub.data as Record<string, unknown>,
      ).params as Record<string, unknown>),
      ...((hub.data as { params?: Record<string, unknown> }).params ?? {}),
    },
  });

  selectPro2NodeAfterSpawn(store.setNodes, hubId);

  return { starterId, hubId, spawnedStarter };
}
