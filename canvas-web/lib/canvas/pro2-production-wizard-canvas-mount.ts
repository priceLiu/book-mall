/**
 * 生产向导 ·「放入画布」后挂载视觉组（三视图 / 分镜图 / 道具媒体卡）
 */
import {
  findPro2CharacterColumnForHub,
  ensurePro2CharacterImageGroup,
} from "./pro2-spawn-character-image-group";
import { ensurePro2FrameImageGroup } from "./pro2-spawn-frame-image-group";
import { ensurePro2VideoBoardGroup } from "./pro2-spawn-video-board-group";
import {
  finalizePro2FrameRowsForCanvasMount,
  finalizePro2VideoRowsForCanvasMount,
} from "./pro2-production-wizard-frame-mount";
import { spawnScriptStudioMediaCardsFromWorkspace } from "./script-studio-media-spawn";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProPropRow,
  StoryProVideoRow,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import { findStarterByHubId } from "./story-workspace-resolver";
import { useCanvasStore } from "./store";
import type { CanvasFlowNode } from "./types";
import { shouldHydratePro2ProductionScaffold } from "./pro2-production-wizard";

type Pro2MediaGroupKind = "character-board" | "frame-board";

function resolveColumnRowsFromHub<T>(
  col: CanvasFlowNode | undefined,
  hubRows: T[] | undefined,
): T[] {
  return (
    (col?.data as { rows?: T[] } | undefined)?.rows ?? hubRows ?? []
  );
}

export function resolveColumnIdFromHubGroup(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
  kind: Pro2MediaGroupKind,
): string | undefined {
  const group = nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === scriptHubId &&
      (n.data as { pro2Kind?: string }).pro2Kind === kind,
  );
  const controllerId = (
    group?.data as { pro2ControllerNodeId?: string }
  )?.pro2ControllerNodeId?.trim();
  if (controllerId && nodes.some((n) => n.id === controllerId)) {
    return controllerId;
  }
  return undefined;
}

/** workspaceIds 里列 id 漂移 / 节点已删时，解析仍存在的列控制器 */
export function resolveLiveColumnNodeId(
  nodes: CanvasFlowNode[],
  columnId: string | undefined,
  expectedType: CanvasFlowNode["type"],
): string | undefined {
  if (!columnId?.trim()) return undefined;
  const node = nodes.find((n) => n.id === columnId);
  return node?.type === expectedType ? columnId : undefined;
}

export function resolveProductionWizardColumnIds(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
  ws?: StoryPro2WorkspaceIds | null,
): Pick<
  StoryPro2WorkspaceIds,
  "characterColumnId" | "frameColumnId" | "videoColumnId"
> {
  const characterColumnId =
    resolveLiveColumnNodeId(
      nodes,
      ws?.characterColumnId,
      "story-pro2-character",
    ) ??
    resolveColumnIdFromHubGroup(nodes, scriptHubId, "character-board") ??
    findPro2CharacterColumnForHub(nodes, scriptHubId)?.id;

  const frameColumnId =
    resolveLiveColumnNodeId(nodes, ws?.frameColumnId, "story-pro2-frame") ??
    resolveColumnIdFromHubGroup(nodes, scriptHubId, "frame-board") ??
    nodes.find(
      (n) =>
        n.type === "story-pro2-frame" &&
        (n.data as { hubNodeId?: string }).hubNodeId === scriptHubId,
    )?.id;

  const videoColumnId =
    resolveLiveColumnNodeId(nodes, ws?.videoColumnId, "story-pro2-video") ??
    (frameColumnId
      ? nodes.find(
          (n) =>
            n.type === "story-pro2-video" &&
            (n.data as { frameColumnId?: string }).frameColumnId ===
              frameColumnId,
        )?.id
      : undefined);

  return { characterColumnId, frameColumnId, videoColumnId };
}

/** 已有媒体组但列控制器 id 漂移时，重新绑定并写 pro2VisualGroupId */
export function rebindProductionWizardMediaGroups(
  scriptHubId: string,
  characterColumnId?: string,
  frameColumnId?: string,
): void {
  const { nodes, updateNodeData, setNodes } = useCanvasStore.getState();

  for (const n of nodes) {
    if (n.type !== "group") continue;
    const d = n.data as {
      pro2HubNodeId?: string;
      pro2Kind?: string;
      pro2ControllerNodeId?: string;
    };
    if (d.pro2HubNodeId !== scriptHubId) continue;

    if (
      d.pro2Kind === "character-board" &&
      characterColumnId &&
      d.pro2ControllerNodeId !== characterColumnId
    ) {
      updateNodeData(n.id, { pro2ControllerNodeId: characterColumnId });
      updateNodeData(characterColumnId, {
        pro2VisualGroupId: n.id,
        hubNodeId: scriptHubId,
      });
    }

    if (
      d.pro2Kind === "frame-board" &&
      frameColumnId &&
      d.pro2ControllerNodeId !== frameColumnId
    ) {
      updateNodeData(n.id, { pro2ControllerNodeId: frameColumnId });
      updateNodeData(frameColumnId, {
        pro2VisualGroupId: n.id,
        hubNodeId: scriptHubId,
      });
    }
  }

  const hideColumnIds = [characterColumnId, frameColumnId].filter(Boolean);
  if (!hideColumnIds.length) return;
  setNodes((prev) =>
    prev.map((n) =>
      hideColumnIds.includes(n.id)
        ? { ...n, selectable: false, focusable: false }
        : n,
    ),
  );
}

function isErroneousPropColumnNode(node: CanvasFlowNode | undefined): boolean {
  if (!node || node.type !== "story-pro2-prop") return false;
  return Array.isArray((node.data as { rows?: unknown }).rows);
}

/** 移除误 spawn 的「道具列」占位节点（应为独立媒体卡） */
export function removeErroneousProductionPropColumn(
  scriptHubId: string,
  propColumnId: string | undefined,
): void {
  if (!propColumnId) return;
  const state = useCanvasStore.getState();
  const propCol = state.nodes.find((n) => n.id === propColumnId);
  if (!isErroneousPropColumnNode(propCol)) return;

  state.setNodes((prev) => prev.filter((n) => n.id !== propColumnId));
  state.setEdges((prev) =>
    prev.filter((e) => e.source !== propColumnId && e.target !== propColumnId),
  );

  const starter = findStarterByHubId(state.nodes, scriptHubId);
  const clearWs = (ws?: StoryPro2WorkspaceIds) => {
    if (!ws?.propColumnId) return ws;
    const next = { ...ws };
    delete next.propColumnId;
    return next;
  };

  if (starter) {
    const ws = (starter.data as { workspaceIds?: StoryPro2WorkspaceIds })
      .workspaceIds;
    const nextWs = clearWs(ws);
    if (nextWs !== ws) {
      state.updateNodeData(starter.id, { workspaceIds: nextWs });
    }
  }

  const hub = state.nodes.find((n) => n.id === scriptHubId);
  if (hub) {
    const ws = (hub.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds;
    const nextWs = clearWs(ws);
    if (nextWs !== ws) {
      state.updateNodeData(scriptHubId, { workspaceIds: nextWs });
    }
  }
}

function syncPropMediaRuntimeFromHub(
  propRows: StoryProPropRow[],
): void {
  const { nodes, updateNodeData } = useCanvasStore.getState();
  for (const row of propRows) {
    const url = pickRuntimeImagePreviewUrl(row.runtime, undefined);
    if (!url) continue;
    for (const n of nodes) {
      if (n.type !== "story-pro2-prop") continue;
      const d = n.data as { scriptStudioSourceRowKey?: string };
      if (d.scriptStudioSourceRowKey !== row.key) continue;
      updateNodeData(n.id, {
        ossUrl: url,
        runtime: row.runtime,
        label: row.name?.trim() || "道具",
      });
    }
  }
}

/** mount 列节点后 · spawn/绑定三视图组、分镜图组、道具媒体卡 */
export function mountProductionVisualGroupsFromStore(scriptHubId: string): void {
  let store = useCanvasStore.getState();
  const hub = store.nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return;

  const hubData = hub.data as StoryProScriptHubNodeData;
  if (!shouldHydratePro2ProductionScaffold(hubData)) return;

  const starter = findStarterByHubId(store.nodes, scriptHubId);
  const ws =
    (starter?.data as { workspaceIds?: StoryPro2WorkspaceIds })?.workspaceIds ??
    (hub.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds;

  const liveColumns = resolveProductionWizardColumnIds(store.nodes, scriptHubId, ws);
  const characterColumnId = liveColumns.characterColumnId;
  const frameColumnId = liveColumns.frameColumnId;
  const videoColumnId = liveColumns.videoColumnId;

  const characterRows = resolveColumnRowsFromHub<StoryProCharacterRow>(
    characterColumnId
      ? store.nodes.find((n) => n.id === characterColumnId)
      : undefined,
    hubData.scriptStudioCharacterRows,
  );
  const sceneRows = hubData.sceneRows ?? [];

  let frameRows = resolveColumnRowsFromHub<StoryProFrameRow>(
    frameColumnId ? store.nodes.find((n) => n.id === frameColumnId) : undefined,
    hubData.scriptStudioFrameRows,
  );
  let videoRows = resolveColumnRowsFromHub<StoryProVideoRow>(
    videoColumnId ? store.nodes.find((n) => n.id === videoColumnId) : undefined,
    hubData.scriptStudioVideoRows,
  );

  frameRows = finalizePro2FrameRowsForCanvasMount({
    frameRows,
    characterRows,
    sceneRows,
    script: hubData.productionScript,
    scriptHubId,
  });
  videoRows = finalizePro2VideoRowsForCanvasMount({ frameRows, videoRows });

  store.updateNodeData(scriptHubId, {
    scriptStudioFrameRows: frameRows,
    scriptStudioVideoRows: videoRows,
  });
  if (characterColumnId) {
    store.updateNodeData(characterColumnId, {
      rows: characterRows,
      hubNodeId: scriptHubId,
    });
  }
  if (frameColumnId) {
    store.updateNodeData(frameColumnId, {
      rows: frameRows,
      hubNodeId: scriptHubId,
    });
  }
  if (videoColumnId) {
    store.updateNodeData(videoColumnId, {
      rows: videoRows,
      hubNodeId: scriptHubId,
      frameColumnId,
    });
  }

  rebindProductionWizardMediaGroups(
    scriptHubId,
    characterColumnId,
    frameColumnId,
  );

  store = useCanvasStore.getState();

  if (characterColumnId) {
    const col = store.nodes.find((n) => n.id === characterColumnId);
    const rows = resolveColumnRowsFromHub<StoryProCharacterRow>(
      col,
      characterRows,
    );

    ensurePro2CharacterImageGroup({
      characterColumnId,
      hubNodeId: scriptHubId,
      rows,
      nodes: store.nodes,
      addNode: store.addNode,
      addNodeInGroup: store.addNodeInGroup,
      createGroupContaining: store.createGroupContaining,
      updateNodeData: store.updateNodeData,
      setNodes: store.setNodes,
      setEdges: store.setEdges,
    });
  }

  store = useCanvasStore.getState();

  if (frameColumnId) {
    const col = store.nodes.find((n) => n.id === frameColumnId);
    const rows = frameRows;

    ensurePro2FrameImageGroup({
      frameColumnId,
      hubNodeId: scriptHubId,
      rows,
      nodes: store.nodes,
      addNode: store.addNode,
      addNodeInGroup: store.addNodeInGroup,
      createGroupContaining: store.createGroupContaining,
      updateNodeData: store.updateNodeData,
      setNodes: store.setNodes,
      setEdges: store.setEdges,
    });
  }

  store = useCanvasStore.getState();

  if (videoColumnId && frameColumnId) {
    ensurePro2VideoBoardGroup({
      videoColumnId,
      frameColumnId,
      hubNodeId: scriptHubId,
      frameRows,
      videoRows,
      nodes: store.nodes,
      addNode: store.addNode,
      addNodeInGroup: store.addNodeInGroup,
      createGroupContaining: store.createGroupContaining,
      updateNodeData: store.updateNodeData,
      setNodes: store.setNodes,
      setEdges: store.setEdges,
    });
  }

  removeErroneousProductionPropColumn(scriptHubId, ws?.propColumnId);

  store = useCanvasStore.getState();
  spawnScriptStudioMediaCardsFromWorkspace({
    hubNodeId: scriptHubId,
    nodes: store.nodes,
    addNode: store.addNode,
    updateNodeData: store.updateNodeData,
    kinds: ["prop"],
  });

  syncPropMediaRuntimeFromHub(hubData.scriptStudioPropRows ?? []);
}
