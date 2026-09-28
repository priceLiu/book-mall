/**
 * 生产向导 ·「放入画布」后挂载视觉组（三视图 / 分镜图 / 道具媒体卡）
 */
import {
  findPro2CharacterColumnForHub,
  ensurePro2CharacterImageGroup,
} from "./pro2-spawn-character-image-group";
import { ensurePro2FrameImageGroup } from "./pro2-spawn-frame-image-group";
import {
  ensurePro2VideoBoardGroup,
  wirePro2VideoBoardRefEdges,
} from "./pro2-spawn-video-board-group";
import {
  ensurePro2SceneImageGroup,
  syncPro2SceneImagesFromRows,
} from "./pro2-spawn-scene-image-group";
import {
  finalizePro2FrameRowsForCanvasMount,
  finalizePro2VideoRowsForCanvasMount,
} from "./pro2-production-wizard-frame-mount";
import { spawnScriptStudioMediaCardsFromWorkspace } from "./script-studio-media-spawn";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import { sceneRowKeysEquivalent } from "./story-pro-scene-asset-catalog";
import { ensurePro2HubToMediaGroupChildEdges } from "./pro2-hub-media-group-edge";
import { relayoutPro2MediaGroup } from "./pro2-media-group-layout";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProPropRow,
  StoryProVideoRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
} from "./story-pro-workspace-types";
import type { StoryRefImage } from "./story-ref-image";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import { findStarterByHubId } from "./story-workspace-resolver";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { shouldHydratePro2ProductionScaffold } from "./pro2-production-wizard";
import { GROUP_COLOR_PRESETS } from "./types";

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

function propGroupLabel(scriptHubId: string, nodes: CanvasFlowNode[]): string {
  const hubs = nodes.filter((n) => n.type === "story-pro2-script-hub");
  const idx = hubs.findIndex((h) => h.id === scriptHubId);
  return `道具图 · 脚本 ${idx >= 0 ? idx + 1 : 1}`;
}

function ensurePro2PropMediaGroup(scriptHubId: string): string | null {
  let store = useCanvasStore.getState();
  const propNodes = store.nodes.filter(
    (n) =>
      n.type === "story-pro2-prop" &&
      (n.data as { hubNodeId?: string }).hubNodeId === scriptHubId,
  );
  if (!propNodes.length) return null;

  let group = store.nodes.find(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2Kind?: string }).pro2Kind === "prop-board" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === scriptHubId,
  );

  let groupId = group?.id;
  if (!groupId) {
    groupId =
      store.createGroupContaining(
        propNodes.map((n) => n.id),
        {
          label: propGroupLabel(scriptHubId, store.nodes),
          color: GROUP_COLOR_PRESETS[4] ?? GROUP_COLOR_PRESETS[3]!,
        },
      ) ?? undefined;
    if (!groupId) return null;
  }

  store.updateNodeData(groupId, {
    pro2Kind: "prop-board",
    pro2HubNodeId: scriptHubId,
    pro2ControllerNodeId: scriptHubId,
    label: propGroupLabel(scriptHubId, store.nodes),
  });

  store = useCanvasStore.getState();
  group = store.nodes.find((n) => n.id === groupId);
  const groupPos = group?.position ?? { x: 0, y: 0 };
  const propNodeIds = new Set(propNodes.map((n) => n.id));
  store.setNodes((prev) =>
    prev.map((n) => {
      if (!propNodeIds.has(n.id)) return n;
      if (n.parentId === groupId) {
        return {
          ...n,
          data: { ...n.data, pro2GroupId: groupId },
        };
      }
      return {
        ...n,
        parentId: groupId ?? undefined,
        extent: "parent",
        position: {
          x: n.position.x - groupPos.x,
          y: n.position.y - groupPos.y,
        },
        data: { ...n.data, pro2GroupId: groupId },
      };
    }),
  );

  relayoutPro2MediaGroup(store.setNodes, groupId, { resetOrigin: true });
  store = useCanvasStore.getState();
  const childIds = store.nodes
    .filter((n) => n.parentId === groupId && n.type === "story-pro2-prop")
    .map((n) => n.id);
  store.setEdges((prev) => {
    let next = ensureHubToPropCardEdges(prev, scriptHubId, childIds);
    ensurePro2HubToMediaGroupChildEdges(
      (fn) => {
        next = fn(next);
      },
      scriptHubId,
      groupId!,
      childIds,
    );
    return next;
  });
  return groupId;
}

function ensureHubToPropCardEdges(
  edges: CanvasFlowEdge[],
  hubNodeId: string,
  propNodeIds: string[],
): CanvasFlowEdge[] {
  let next = edges;
  for (const nodeId of propNodeIds) {
    if (!nodeId?.trim()) continue;
    const exists = next.some(
      (e) =>
        e.source === hubNodeId &&
        e.target === nodeId &&
        (e.targetHandle === "in_image" ||
          e.targetHandle === "in_text" ||
          e.targetHandle == null),
    );
    if (exists) continue;
    next = [
      ...next,
      {
        id: `e-hub-prop-${hubNodeId.slice(-6)}-${nodeId.slice(-6)}`,
        source: hubNodeId,
        target: nodeId,
        sourceHandle: "text",
        targetHandle: "in_image",
      },
    ];
  }
  return next;
}

function collectRefKeysByPrefix(
  refs: StoryRefImage[] | undefined,
  prefix: string,
): string[] {
  const out: string[] = [];
  for (const ref of refs ?? []) {
    const id = ref.id?.trim();
    if (!id?.startsWith(prefix)) continue;
    const key = id.slice(prefix.length).trim();
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function sourceHandleForAssetNode(node: CanvasFlowNode): string {
  if (node.type === "story-pro2-three-view") return "image";
  if (node.type === "story-pro2-prop") return "image";
  if (node.type === "story-pro2-image") return "image";
  return "image";
}

type FrameAssetSources = Map<string, Set<string>>;

function collectFrameAssetSources(
  nodes: CanvasFlowNode[],
  frameRows: StoryProFrameRow[],
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
): FrameAssetSources {
  const characterByKey = new Map<string, CanvasFlowNode>();
  const sceneByKey = new Map<string, CanvasFlowNode>();
  const propByKey = new Map<string, CanvasFlowNode>();

  for (const node of nodes) {
    if (node.type === "story-pro2-three-view") {
      const key = (node.data as { pro2RowKey?: string }).pro2RowKey?.trim();
      if (key) characterByKey.set(key, node);
      continue;
    }

    if (
      node.type === "story-pro2-image" &&
      (node.data as { pro2MediaRole?: string }).pro2MediaRole === "scene"
    ) {
      const key = (node.data as { pro2RowKey?: string }).pro2RowKey?.trim();
      if (key) sceneByKey.set(key, node);
      continue;
    }

    if (node.type === "story-pro2-prop") {
      const key = (
        node.data as { scriptStudioSourceRowKey?: string }
      ).scriptStudioSourceRowKey?.trim();
      if (key) propByKey.set(key, node);
    }
  }

  const sceneNameByKey = new Map(sceneRows.map((row) => [row.key, row.name]));
  const sourceByUrl = new Map<string, string>();
  const sourceByName = new Map<string, string[]>();
  const assetNodes = [
    ...characterByKey.values(),
    ...sceneByKey.values(),
    ...propByKey.values(),
  ];
  for (const node of assetNodes) {
    const d = node.data as {
      label?: string;
      runtime?: { ossUrl?: string; ephemeralUrl?: string };
      ossUrl?: string;
    };
    const label = d.label?.trim();
    if (label) {
      const list = sourceByName.get(label) ?? [];
      if (!list.includes(node.id)) list.push(node.id);
      sourceByName.set(label, list);
    }
    const urls = [d.ossUrl, d.runtime?.ossUrl, d.runtime?.ephemeralUrl];
    for (const raw of urls) {
      const url = raw?.trim();
      if (url?.startsWith("http")) sourceByUrl.set(url, node.id);
    }
  }

  const byRow = new Map<string, Set<string>>();
  for (const row of frameRows) {
    const charKeys = new Set<string>([
      ...(row.characterRefIds ?? []),
      ...collectRefKeysByPrefix(row.refImages, "ref-char-"),
    ]);
    const sceneKeys = new Set<string>([
      ...collectRefKeysByPrefix(row.refImages, "ref-scene-"),
    ]);
    if (row.sceneRefId?.trim()) {
      for (const s of sceneRows) {
        if (
          sceneRowKeysEquivalent(s.key, row.sceneRefId) ||
          s.name === row.sceneRefId
        ) {
          sceneKeys.add(s.key);
        }
      }
    }
    const propKeys = new Set<string>([
      ...(row.propRefIds ?? []),
      ...collectRefKeysByPrefix(row.refImages, "ref-prop-"),
    ]);

    const sources = new Set<string>();
    for (const key of charKeys) {
      const source = characterByKey.get(key);
      if (source) sources.add(source.id);
    }
    for (const key of sceneKeys) {
      const source = sceneByKey.get(key);
      if (source) {
        sources.add(source.id);
        continue;
      }
      const byName = sceneNameByKey.get(key);
      if (!byName) continue;
      for (const [sceneKey, sceneNode] of sceneByKey) {
        if (sceneNameByKey.get(sceneKey) === byName) sources.add(sceneNode.id);
      }
    }
    for (const key of propKeys) {
      const source = propByKey.get(key);
      if (source) sources.add(source.id);
    }
    for (const ref of row.refImages ?? []) {
      const refUrl = ref.url?.trim();
      if (refUrl) {
        const byUrl = sourceByUrl.get(refUrl);
        if (byUrl) sources.add(byUrl);
      }
      const refLabel = ref.label?.trim();
      if (refLabel) {
        for (const id of sourceByName.get(refLabel) ?? []) sources.add(id);
      }
    }
    byRow.set(row.key, sources);
  }
  return byRow;
}

function ensureAssetToFrameEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  frameColumnId: string | undefined,
  frameRows: StoryProFrameRow[],
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
): CanvasFlowEdge[] {
  if (!frameColumnId) return edges;
  const frameByRowKey = new Map<string, CanvasFlowNode>();
  for (const node of nodes) {
    if (
      node.type === "story-pro2-image" &&
      (node.data as { pro2ControllerNodeId?: string }).pro2ControllerNodeId ===
        frameColumnId
    ) {
      const rowKey = (
        node.data as { pro2RowKey?: string }
      ).pro2RowKey?.trim();
      if (rowKey) frameByRowKey.set(rowKey, node);
    }
  }
  const frameSources = collectFrameAssetSources(
    nodes,
    frameRows,
    characterRows,
    sceneRows,
  );
  const nextEdges = [...edges];
  for (const [rowKey, sourceIds] of frameSources) {
    const frameNode = frameByRowKey.get(rowKey);
    if (!frameNode) continue;

    for (const sourceId of sourceIds) {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) continue;
      const exists = nextEdges.some(
        (e) =>
          e.source === sourceId &&
          e.target === frameNode.id &&
          (e.targetHandle === "in_image" ||
            e.targetHandle === "in_ref" ||
            e.targetHandle == null),
      );
      if (exists) continue;
      nextEdges.push({
        id: `e-asset-frame-${sourceId.slice(-6)}-${frameNode.id.slice(-6)}`,
        source: sourceId,
        target: frameNode.id,
        sourceHandle: sourceHandleForAssetNode(sourceNode),
        targetHandle: "in_image",
      });
    }
  }
  return nextEdges;
}

function ensureAssetToVideoEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  videoColumnId: string | undefined,
  frameRows: StoryProFrameRow[],
  characterRows: StoryProCharacterRow[],
  sceneRows: StoryProSceneRow[],
): CanvasFlowEdge[] {
  if (!videoColumnId) return edges;
  const videoByRowKey = new Map<string, CanvasFlowNode>();
  for (const node of nodes) {
    if (node.type !== "sbv1-video-engine") continue;
    const d = node.data as { pro2ControllerNodeId?: string; pro2RowKey?: string };
    if (d.pro2ControllerNodeId !== videoColumnId) continue;
    const rowKey = d.pro2RowKey?.trim();
    if (rowKey) videoByRowKey.set(rowKey, node);
  }

  const frameSources = collectFrameAssetSources(
    nodes,
    frameRows,
    characterRows,
    sceneRows,
  );
  const nextEdges = [...edges];
  for (const [rowKey, sourceIds] of frameSources) {
    const videoNode = videoByRowKey.get(rowKey);
    if (!videoNode) continue;
    for (const sourceId of sourceIds) {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      if (!sourceNode) continue;
      const exists = nextEdges.some(
        (e) =>
          e.source === sourceId &&
          e.target === videoNode.id &&
          (e.targetHandle === "in_ref" ||
            e.targetHandle === "in_image" ||
            e.targetHandle == null),
      );
      if (exists) continue;
      nextEdges.push({
        id: `e-asset-video-${sourceId.slice(-6)}-${videoNode.id.slice(-6)}`,
        source: sourceId,
        target: videoNode.id,
        sourceHandle: sourceHandleForAssetNode(sourceNode),
        targetHandle: "in_ref",
      });
    }
  }
  return nextEdges;
}

function layoutWizardGroupsParallel(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): CanvasFlowNode[] {
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub) return nodes;
  const groups = nodes.filter(
    (n) =>
      n.type === "group" &&
      (n.data as { pro2HubNodeId?: string }).pro2HubNodeId === scriptHubId,
  );
  if (!groups.length) return nodes;

  const byKind = new Map<string, CanvasFlowNode>();
  for (const g of groups) {
    const kind = (g.data as { pro2Kind?: string }).pro2Kind?.trim();
    if (!kind) continue;
    byKind.set(kind, g);
  }
  const characterGroup = byKind.get("character-board");
  const sceneGroup = byKind.get("scene-board");
  const propGroup = byKind.get("prop-board");
  const frameGroup = byKind.get("frame-board");
  const videoGroup = byKind.get("video-board");

  const hubW = hub.width ?? 640;
  const gap = 72;
  const topY = hub.position.y + 28;
  let xCursor = hub.position.x + hubW + 100;
  const patch = new Map<string, { x: number; y: number }>();

  const placeGroup = (group: CanvasFlowNode | undefined) => {
    if (!group) return;
    patch.set(group.id, { x: xCursor, y: topY });
    const w = group.width ?? 820;
    xCursor += w + gap;
  };

  placeGroup(characterGroup);
  placeGroup(sceneGroup);
  placeGroup(propGroup);

  const assetBottom = Math.max(
    topY + (characterGroup?.height ?? 0),
    topY + (sceneGroup?.height ?? 0),
    topY + (propGroup?.height ?? 0),
  );
  void assetBottom;
  const lowerY = topY;
  if (frameGroup) {
    patch.set(frameGroup.id, { x: xCursor, y: lowerY });
    xCursor += (frameGroup.width ?? 980) + gap;
  }
  if (videoGroup) {
    patch.set(videoGroup.id, {
      x: xCursor,
      y: lowerY,
    });
  }

  if (!patch.size) return nodes;
  return nodes.map((n) => {
    const p = patch.get(n.id);
    if (!p) return n;
    return { ...n, position: p };
  });
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
    propRows: hubData.scriptStudioPropRows ?? [],
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
  const sceneGroupId = ensurePro2SceneImageGroup({
    hubNodeId: scriptHubId,
    rows: sceneRows,
    starterNodeId: starter?.id,
    legacySceneColumnId: ws?.sceneColumnId,
    nodes: store.nodes,
    edges: store.edges,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
  });
  void sceneGroupId;
  store = useCanvasStore.getState();
  syncPro2SceneImagesFromRows(
    store.nodes,
    scriptHubId,
    sceneRows,
    store.updateNodeData,
  );
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
    store = useCanvasStore.getState();
    wirePro2VideoBoardRefEdges(
      store.setEdges,
      store.nodes,
      videoColumnId,
      frameColumnId,
    );
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

  store = useCanvasStore.getState();
  ensurePro2PropMediaGroup(scriptHubId);
  store = useCanvasStore.getState();
  syncPropMediaRuntimeFromHub(
    ((store.nodes.find((n) => n.id === scriptHubId)?.data as StoryProScriptHubNodeData)
      ?.scriptStudioPropRows ?? hubData.scriptStudioPropRows) ?? [],
  );

  store = useCanvasStore.getState();
  const propNodeIds = store.nodes
    .filter(
      (n) =>
        n.type === "story-pro2-prop" &&
        (n.data as { hubNodeId?: string }).hubNodeId === scriptHubId,
    )
    .map((n) => n.id);
  store.setEdges((prev) => ensureHubToPropCardEdges(prev, scriptHubId, propNodeIds));
  store = useCanvasStore.getState();
  store.setEdges((prev) =>
    ensureAssetToFrameEdges(
      store.nodes,
      prev,
      frameColumnId,
      frameRows,
      characterRows,
      sceneRows,
    ),
  );
  store = useCanvasStore.getState();
  store.setEdges((prev) =>
    ensureAssetToVideoEdges(
      store.nodes,
      prev,
      videoColumnId,
      frameRows,
      characterRows,
      sceneRows,
    ),
  );

  store = useCanvasStore.getState();
  store.setNodes((prev) => layoutWizardGroupsParallel(prev, scriptHubId));
}

export function listProductionWizardFocusNodeIdsFromStore(
  scriptHubId: string,
): string[] {
  const { nodes } = useCanvasStore.getState();
  const out: string[] = [];
  const push = (id: string | undefined) => {
    const t = id?.trim();
    if (!t || out.includes(t)) return;
    if (!nodes.some((n) => n.id === t)) return;
    out.push(t);
  };

  push(scriptHubId);
  for (const n of nodes) {
    if (n.type !== "group") continue;
    const d = n.data as { pro2HubNodeId?: string; pro2Kind?: string };
    if (d.pro2HubNodeId !== scriptHubId) continue;
    if (
      d.pro2Kind === "character-board" ||
      d.pro2Kind === "scene-board" ||
      d.pro2Kind === "prop-board" ||
      d.pro2Kind === "frame-board" ||
      d.pro2Kind === "video-board"
    ) {
      push(n.id);
    }
  }

  if (out.length <= 1) {
    for (const n of nodes) {
      const d = n.data as { hubNodeId?: string };
      if (d.hubNodeId === scriptHubId) push(n.id);
    }
  }

  return out;
}
