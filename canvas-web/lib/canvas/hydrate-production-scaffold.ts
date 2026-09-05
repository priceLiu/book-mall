/**
 * 剧本可视化 · 生产向导 v2（见 docs/剧本可视化功能.md）
 *
 * - sync：仅写 Hub 内嵌 rows / productionWizardMode（不生画布节点）
 * - mount：用户点「放入画布」后再 spawn 列节点（不含旧「场景设计」列）
 */
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type {
  StoryProScriptHubNodeData,
  StoryProStarterNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import {
  spawnStoryPro2CharacterColumnFromHub,
  spawnStoryPro2FrameColumnFromHub,
  spawnStoryPro2ScriptHub,
  spawnStoryPro2VideoColumnFromFrame,
} from "./spawn-story-pro2-workspace";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "./story-pro-prompts";
import { STORY_PRO2_THEME_OUTLINE_SYSTEM } from "./story-pro2-theme-outline-prompt";
import { syncStoryProColumnRows } from "./story-pro-column-sync";
import { findStarterByHubId } from "./story-workspace-resolver";
import { migratePro2SceneColumnOffCanvas } from "./pro2-spawn-scene-image-group";
import {
  mountProductionVisualGroupsFromStore,
  resolveColumnIdFromHubGroup,
  resolveProductionWizardColumnIds,
} from "./pro2-production-wizard-canvas-mount";
import { useCanvasStore } from "./store";
import { shouldHydratePro2ProductionScaffold } from "./pro2-production-wizard";

type Pro2AddNode = (
  type: string,
  position: { x: number; y: number },
  data: Record<string, unknown>,
) => string;

export type HydrateProductionScaffoldArgs = {
  scriptHubId: string;
  hubData: StoryProScriptHubNodeData;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: Pro2AddNode;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

export type MountProductionScaffoldArgs = HydrateProductionScaffoldArgs & {
  setNodes?: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
};

function connect(
  setEdges: HydrateProductionScaffoldArgs["setEdges"],
  source: string,
  target: string,
) {
  setEdges((prev) => {
    if (prev.some((e) => e.source === source && e.target === target)) {
      return prev;
    }
    return [
      ...prev,
      {
        id: `e-pw-${source.slice(-4)}-${target.slice(-4)}`,
        source,
        target,
        sourceHandle: "text",
        targetHandle: "in_text",
      },
    ];
  });
}

function resolveAnchor(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): { anchorId: string; workspaceIds?: StoryPro2WorkspaceIds } {
  const starter = findStarterByHubId(nodes, scriptHubId);
  if (starter) {
    return {
      anchorId: starter.id,
      workspaceIds: (starter.data as StoryProStarterNodeData).workspaceIds,
    };
  }
  const hub = nodes.find((n) => n.id === scriptHubId);
  return {
    anchorId: scriptHubId,
    workspaceIds: (hub?.data as { workspaceIds?: StoryPro2WorkspaceIds })
      .workspaceIds,
  };
}

function withIdleTtsRuntime(rows: StoryProVideoRow[]): StoryProVideoRow[] {
  return rows.map((row) => ({
    ...row,
    ttsRuntime: row.ttsRuntime ?? { status: "idle" },
  }));
}

function buildSyncedRows(hubData: StoryProScriptHubNodeData, scriptHubId: string) {
  const synced = syncStoryProColumnRows(
    hubData,
    {
      characterRows: hubData.scriptStudioCharacterRows,
      sceneRows: hubData.sceneRows,
      frameRows: hubData.scriptStudioFrameRows,
      videoRows: hubData.scriptStudioVideoRows,
    },
    scriptHubId,
  );
  return {
    ...synced,
    videoRows: withIdleTtsRuntime(synced.videoRows),
  };
}

/** Pass1 后 · 仅同步 Hub 内嵌数据（不 spawn 画布节点） */
export function syncProductionScaffoldDataToHub(
  hubData: StoryProScriptHubNodeData,
  scriptHubId?: string,
): Partial<StoryProScriptHubNodeData> | null {
  if (!shouldHydratePro2ProductionScaffold(hubData)) return null;
  const synced = buildSyncedRows(hubData, scriptHubId ?? "");
  return {
    productionWizardMode: true,
    scriptStudioCharacterRows: synced.characterRows,
    sceneRows: synced.sceneRows,
    scriptStudioFrameRows: synced.frameRows,
    scriptStudioVideoRows: synced.videoRows,
  };
}

export function syncProductionScaffoldDataToHubFromStore(
  scriptHubId: string,
): boolean {
  const state = useCanvasStore.getState();
  const hub = state.nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return false;
  const hubData = hub.data as StoryProScriptHubNodeData;
  const patch = syncProductionScaffoldDataToHub(hubData, scriptHubId);
  if (!patch) return false;
  state.updateNodeData(scriptHubId, patch);
  return true;
}

/**
 * 用户点「放入画布」· spawn 列节点并同步 rows。
 * 不 spawn 旧「场景设计」列（story-pro2-scene）；场景行仅挂 Hub.sceneRows。
 */
export function mountProductionScaffoldToCanvas(
  args: MountProductionScaffoldArgs,
): StoryPro2WorkspaceIds | null {
  if (!shouldHydratePro2ProductionScaffold(args.hubData)) return null;

  let workingNodes = args.nodes;
  let workingEdges = args.edges;
  if (args.setNodes) {
    const migrated = migratePro2SceneColumnOffCanvas(workingNodes, workingEdges);
    workingNodes = migrated.nodes;
    workingEdges = migrated.edges;
    args.setNodes(() => migrated.nodes);
    args.setEdges(() => migrated.edges);
  }

  const { anchorId, workspaceIds: initialWs } = resolveAnchor(
    workingNodes,
    args.scriptHubId,
  );
  let ws: Partial<StoryPro2WorkspaceIds> = { ...(initialWs ?? {}) };
  delete ws.sceneColumnId;

  let nodesSnapshot = [...workingNodes];

  const liveColumns = resolveProductionWizardColumnIds(
    nodesSnapshot,
    args.scriptHubId,
    ws as StoryPro2WorkspaceIds,
  );
  ws.characterColumnId = liveColumns.characterColumnId;
  ws.frameColumnId = liveColumns.frameColumnId;
  ws.videoColumnId = liveColumns.videoColumnId;

  const addNodeTracked: Pro2AddNode = (type, position, data) => {
    const id = args.addNode(type, position, data);
    nodesSnapshot = [
      ...nodesSnapshot,
      {
        id,
        type: type as CanvasFlowNode["type"],
        position,
        data,
      },
    ];
    return id;
  };

  const spawnArgs = {
    ...args,
    nodes: nodesSnapshot,
    addNode: addNodeTracked as never,
  };

  const anchorNode = nodesSnapshot.find((n) => n.id === anchorId);
  const anchorData = anchorNode?.data as StoryProStarterNodeData | undefined;
  const sharedLlm = {
    providerId: anchorData?.providerId ?? args.hubData.providerId ?? "",
    modelKey: anchorData?.modelKey ?? args.hubData.modelKey ?? "",
    params: {
      ...STORY_PRO_LLM_PARAMS_DEFAULT,
      ...(anchorData?.params ?? args.hubData.params ?? {}),
    },
  };

  let scriptHubId = args.scriptHubId;
  if (!nodesSnapshot.some((n) => n.id === scriptHubId) && !ws.scriptHubId) {
    const { scriptHubId: spawnedHubId } = spawnStoryPro2ScriptHub({
      starterNodeId: anchorId,
      systemPrompt: STORY_PRO2_THEME_OUTLINE_SYSTEM,
      ...sharedLlm,
      nodes: nodesSnapshot,
      edges: args.edges,
      addNode: addNodeTracked as never,
      setEdges: args.setEdges,
      updateNodeData: args.updateNodeData,
    });
    scriptHubId = spawnedHubId;
    ws = { ...ws, scriptHubId };
  }

  const columnSpawnBase = {
    scriptHubId,
    starterNodeId: anchorId,
    nodes: nodesSnapshot,
    edges: workingEdges,
    addNode: addNodeTracked as never,
    setEdges: args.setEdges,
    updateNodeData: args.updateNodeData,
  };

  if (!ws.characterColumnId) {
    ws.characterColumnId =
      resolveColumnIdFromHubGroup(
        nodesSnapshot,
        scriptHubId,
        "character-board",
      ) ??
      spawnStoryPro2CharacterColumnFromHub(columnSpawnBase);
  }
  // 场景：不 spawn story-pro2-scene（旧「场景设计」列）；sceneRows 挂 Hub
  if (!ws.frameColumnId) {
    ws.frameColumnId =
      resolveColumnIdFromHubGroup(
        nodesSnapshot,
        scriptHubId,
        "frame-board",
      ) ?? spawnStoryPro2FrameColumnFromHub(columnSpawnBase);
  }
  // 道具 / 音效：生产向导 Step2 再挂；此处不 spawn 伪列节点
  if (ws.frameColumnId && !ws.videoColumnId) {
    ws.videoColumnId = spawnStoryPro2VideoColumnFromFrame({
      ...columnSpawnBase,
      frameColumnId: ws.frameColumnId,
    });
  }

  const synced = buildSyncedRows(args.hubData, scriptHubId);

  args.updateNodeData(anchorId, {
    workspaceIds: { ...ws, sceneColumnId: undefined },
    productionWizardMode: true,
  });
  args.updateNodeData(scriptHubId, {
    productionWizardMode: true,
    scriptStudioCharacterRows: synced.characterRows,
    sceneRows: synced.sceneRows,
    scriptStudioFrameRows: synced.frameRows,
    scriptStudioPropRows: args.hubData.scriptStudioPropRows,
    scriptStudioAudioRows: args.hubData.scriptStudioAudioRows,
    scriptStudioVideoRows: synced.videoRows,
    workspaceIds: { ...ws, sceneColumnId: undefined },
  });

  if (ws.characterColumnId) {
    args.updateNodeData(ws.characterColumnId, {
      rows: synced.characterRows,
      hubNodeId: scriptHubId,
    });
  }
  if (ws.frameColumnId) {
    args.updateNodeData(ws.frameColumnId, {
      rows: synced.frameRows,
      hubNodeId: scriptHubId,
    });
  }
  if (ws.videoColumnId) {
    args.updateNodeData(ws.videoColumnId, {
      rows: synced.videoRows,
      hubNodeId: scriptHubId,
      frameColumnId: ws.frameColumnId,
    });
  }

  return { ...(ws as StoryPro2WorkspaceIds), sceneColumnId: undefined };
}

export function mountProductionScaffoldToCanvasFromStore(
  scriptHubId: string,
): boolean {
  const state = useCanvasStore.getState();
  const hub = state.nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return false;
  const hubData = hub.data as StoryProScriptHubNodeData;
  if (!shouldHydratePro2ProductionScaffold(hubData)) return false;

  const result = mountProductionScaffoldToCanvas({
    scriptHubId,
    hubData,
    nodes: state.nodes,
    edges: state.edges,
    addNode: (type, position, data) =>
      state.addNode(type as never, position, data),
    setEdges: state.setEdges,
    setNodes: state.setNodes,
    updateNodeData: state.updateNodeData,
  });
  if (result != null) {
    mountProductionVisualGroupsFromStore(scriptHubId);
  }
  return result != null;
}

/** @deprecated 使用 sync + mount 分离；保留别名供旧测试 */
export function hydrateProductionScaffold(
  args: HydrateProductionScaffoldArgs,
): StoryPro2WorkspaceIds | null {
  return mountProductionScaffoldToCanvas(args);
}

export function shouldHydrateProductionScaffold(
  hubData?: StoryProScriptHubNodeData | null,
): boolean {
  return shouldHydratePro2ProductionScaffold(hubData);
}

/** @deprecated 请用 syncProductionScaffoldDataToHubFromStore / mountProductionScaffoldToCanvasFromStore */
export function hydrateProductionScaffoldFromStore(scriptHubId: string): boolean {
  syncProductionScaffoldDataToHubFromStore(scriptHubId);
  return false;
}
