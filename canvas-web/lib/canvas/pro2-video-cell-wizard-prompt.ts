"use client";

/**
 * 分镜视频组格 ⇄ 剧本创作「分镜视频」提示词
 *
 * 视频格 Dock 只认已连线上游 `@<sbv1-ref-{节点id}>`；向导用 `@<wiz-char|scene|prop-*>`。
 * 载入画布 / 实时同步时按此表互转，并按提示词实际引用的资产重连 in_ref 边。
 */
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";
import {
  defaultWizardShotPrompt,
  shotRowKey,
  wizardShotDraftKey,
} from "./pro2-production-wizard-shot-drafts";
import {
  sceneRowKeysEquivalent,
  storyProSceneRowKey,
} from "./story-pro-scene-asset-catalog";
import { parseReferencedIds } from "./dock-mention-parse";
import { prepareWizardShotEditorState } from "./pro2-frame-shot-ref-prep";
import type {
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import { useCanvasStore } from "./store";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const SBV1_REF_PREFIX = "sbv1-ref-";
const AUTO_EDGE_PREFIXES = ["e-asset-video-", "e-wiz-video-ref-"];

export type WizardVideoAssetIndex = {
  /** 向导 / 分镜 token id（wiz-char-x、ref-scene-key …）→ 画布资产节点 id */
  byToken: Map<string, string>;
  /** 画布资产节点 id → 向导 token id */
  byNodeId: Map<string, string>;
  /** 向导 token id → 显示名（找不到节点时退化为纯文本） */
  labelByToken: Map<string, string>;
};

function nodeHubId(
  node: CanvasFlowNode,
  byId: Map<string, CanvasFlowNode>,
): string {
  const d = node.data as {
    pro2HubNodeId?: string;
    hubNodeId?: string;
    pro2ControllerNodeId?: string;
  };
  const controller = d.pro2ControllerNodeId
    ? byId.get(d.pro2ControllerNodeId)
    : undefined;
  return (
    d.pro2HubNodeId?.trim() ||
    d.hubNodeId?.trim() ||
    (controller?.data as { hubNodeId?: string } | undefined)?.hubNodeId?.trim() ||
    ""
  );
}

export function buildWizardVideoAssetIndex(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
  hubData: StoryProScriptHubNodeData,
): WizardVideoAssetIndex {
  const byToken = new Map<string, string>();
  const byNodeId = new Map<string, string>();
  const labelByToken = new Map<string, string>();
  const script = hubData.productionScript as Pro2ProductionScript | undefined;
  if (!script) return { byToken, byNodeId, labelByToken };

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const sceneRows = hubData.sceneRows ?? [];

  const bind = (wizToken: string, aliases: string[], nodeId: string) => {
    byToken.set(wizToken, nodeId);
    for (const a of aliases) byToken.set(a, nodeId);
    byNodeId.set(nodeId, wizToken);
  };

  for (const c of script.characters ?? []) {
    labelByToken.set(`wiz-char-${c.id}`, c.name);
  }
  for (const s of script.scenes ?? []) {
    labelByToken.set(`wiz-scene-${s.id}`, s.name);
  }
  for (const p of script.props ?? []) {
    labelByToken.set(`wiz-prop-${p.id}`, p.name);
  }

  // 同一资产可能有多份节点（历史组）：取数组中最后一个（最新放入）
  for (const node of nodes) {
    if (nodeHubId(node, byId) !== scriptHubId) continue;
    const d = node.data as {
      pro2MediaRole?: string;
      pro2RowKey?: string;
      scriptStudioSourceRowKey?: string;
    };
    if (
      node.type === "story-pro2-three-view" ||
      (node.type === "story-pro2-image" && d.pro2MediaRole === "character-three-view")
    ) {
      const id = d.pro2RowKey?.trim();
      if (id && script.characters?.some((c) => c.id === id)) {
        bind(`wiz-char-${id}`, [`ref-char-${id}`], node.id);
      }
      continue;
    }
    if (node.type === "story-pro2-image" && d.pro2MediaRole === "scene") {
      const rowKey = d.pro2RowKey?.trim();
      if (!rowKey) continue;
      const rowName = sceneRows.find((r) => sceneRowKeysEquivalent(r.key, rowKey))?.name;
      const scene = script.scenes?.find(
        (s) =>
          sceneRowKeysEquivalent(rowKey, storyProSceneRowKey(scriptHubId, s.name)) ||
          (rowName !== undefined && rowName === s.name),
      );
      if (scene) {
        bind(`wiz-scene-${scene.id}`, [`ref-scene-${rowKey}`], node.id);
      }
      continue;
    }
    if (node.type === "story-pro2-prop") {
      const id = d.scriptStudioSourceRowKey?.trim();
      if (id && script.props?.some((p) => p.id === id)) {
        bind(`wiz-prop-${id}`, [`ref-prop-${id}`], node.id);
      }
    }
  }
  return { byToken, byNodeId, labelByToken };
}

function replaceMentionTokens(
  text: string,
  map: (id: string) => string | null,
): string {
  return text.replace(/@<([^<>\s]+)>/g, (whole, id: string) => {
    const next = map(id);
    return next === null ? whole : next;
  });
}

/** 向导提示词 → 视频格 Dock（@<sbv1-ref-节点id>；无对应节点时退化为 @名称 纯文本） */
export function wizardPromptToVideoDock(
  text: string,
  index: WizardVideoAssetIndex,
): string {
  if (!text.trim()) return text;
  return replaceMentionTokens(text, (id) => {
    const nodeId = index.byToken.get(id);
    if (nodeId) return `@<${SBV1_REF_PREFIX}${nodeId}>`;
    const label = index.labelByToken.get(id);
    return label ? `@${label}` : null;
  });
}

/** 视频格 Dock → 向导提示词（@<sbv1-ref-节点id> → @<wiz-*>） */
export function videoDockToWizardPrompt(
  text: string,
  index: WizardVideoAssetIndex,
): string {
  if (!text.trim()) return text;
  return replaceMentionTokens(text, (id) => {
    if (!id.startsWith(SBV1_REF_PREFIX)) return null;
    const wiz = index.byNodeId.get(id.slice(SBV1_REF_PREFIX.length));
    return wiz ? `@<${wiz}>` : null;
  });
}

/** 视频 Dock 文本中引用到的资产节点 id */
export function referencedVideoAssetNodeIds(
  dockText: string,
  index: WizardVideoAssetIndex,
): string[] {
  const assetNodeIds = new Set(index.byNodeId.keys());
  const out: string[] = [];
  for (const id of parseReferencedIds(dockText)) {
    if (!id.startsWith(SBV1_REF_PREFIX)) continue;
    const nodeId = id.slice(SBV1_REF_PREFIX.length);
    if (assetNodeIds.has(nodeId) && !out.includes(nodeId)) out.push(nodeId);
  }
  return out;
}

/**
 * 与剧本创作「分镜视频」弹层打开时一致：纯文本名称 → @<wiz-*>，并补本镜关联实体前缀。
 */
export function hydrateWizardVideoPrompt(
  hubData: StoryProScriptHubNodeData,
  shotIndex: number,
  rawPrompt: string,
): { prompt: string; refTokenIds: string[] } {
  const script = hubData.productionScript as Pro2ProductionScript | undefined;
  const shot = script?.shots?.find((s) => s.index === shotIndex);
  if (!script || !shot) return { prompt: rawPrompt, refTokenIds: [] };
  const prepared = prepareWizardShotEditorState({
    prompt: rawPrompt,
    mediaKind: "video",
    script,
    shot,
    assetDrafts: hubData.productionWizardAssetDrafts,
  });
  return {
    prompt: prepared.prompt,
    refTokenIds: prepared.refImages.map((r) => r.id),
  };
}

/** 剧本创作「分镜视频」当前提示词（已补 @ 引用）+ 参考图 token */
export function resolveWizardVideoShotPrompt(
  hubData: StoryProScriptHubNodeData,
  shotIndex: number,
): { prompt: string; refTokenIds: string[] } {
  const draft = hubData.productionWizardShotDrafts?.[
    wizardShotDraftKey("video", shotIndex)
  ];
  const script = hubData.productionScript as Pro2ProductionScript | undefined;
  const shot = script?.shots?.find((s) => s.index === shotIndex);
  const raw =
    draft?.prompt?.trim() || (shot ? defaultWizardShotPrompt("video", shot) : "");
  const hydrated = hydrateWizardVideoPrompt(hubData, shotIndex, raw);
  const refTokenIds = [...hydrated.refTokenIds];
  for (const r of draft?.refImages ?? []) {
    const id = r.id?.trim() ?? "";
    if (id.startsWith("wiz-") && !refTokenIds.includes(id)) refTokenIds.push(id);
  }
  return { prompt: hydrated.prompt, refTokenIds };
}

/** 按引用资产重建视频格 in_ref 资产边（保留分镜图→视频边与用户手连的边） */
export function reconcileVideoCellAssetEdges(
  edges: CanvasFlowEdge[],
  cellId: string,
  assetNodeIds: string[],
  allAssetNodeIds: Set<string>,
): CanvasFlowEdge[] {
  const wanted = new Set(assetNodeIds);
  let changed = false;
  const kept = edges.filter((e) => {
    if (e.target !== cellId) return true;
    const auto = AUTO_EDGE_PREFIXES.some((p) => e.id.startsWith(p));
    if (auto && allAssetNodeIds.has(e.source) && !wanted.has(e.source)) {
      changed = true;
      return false;
    }
    return true;
  });
  const next = [...kept];
  for (const sourceId of assetNodeIds) {
    const exists = next.some(
      (e) =>
        e.source === sourceId &&
        e.target === cellId &&
        (e.targetHandle === "in_ref" ||
          e.targetHandle === "in_image" ||
          e.targetHandle == null),
    );
    if (exists) continue;
    changed = true;
    next.push({
      id: `e-wiz-video-ref-${sourceId.slice(-8)}-${cellId.slice(-8)}`,
      source: sourceId,
      target: cellId,
      sourceHandle: "image",
      targetHandle: "in_ref",
    });
  }
  return changed ? next : edges;
}

function patchVideoRowsPrompt(
  rows: StoryProVideoRow[] | undefined,
  rowKey: string,
  text: string,
): StoryProVideoRow[] | null {
  if (!rows?.length) return null;
  let changed = false;
  const next = rows.map((r) => {
    if (r.key !== rowKey || r.videoPrompt === text) return r;
    changed = true;
    return { ...r, videoPrompt: text };
  });
  return changed ? next : null;
}

/** 写视频格 Dock 提示词 + 视频列行 + Hub 行，并重连引用资产边 */
export function writeVideoCellDockPrompt(args: {
  scriptHubId: string;
  cellId: string;
  shotIndex: number;
  dockText: string;
  index: WizardVideoAssetIndex;
  extraAssetNodeIds?: string[];
  writeNode: boolean;
  /** 画布侧改 Dock 时不动连线（用户可能正在手连上游） */
  reconcileEdges?: boolean;
}): void {
  const store = useCanvasStore.getState();
  const cell = store.nodes.find((n) => n.id === args.cellId);
  if (!cell) return;
  const rowKey = shotRowKey(args.shotIndex);

  if (args.writeNode) {
    const d = cell.data as { prompt?: string; dockInput?: string };
    if (d.prompt !== args.dockText || d.dockInput !== args.dockText) {
      store.updateNodeData(args.cellId, {
        prompt: args.dockText,
        dockInput: args.dockText,
      });
    }
  }

  const controllerId = (cell.data as { pro2ControllerNodeId?: string })
    .pro2ControllerNodeId;
  const col = controllerId
    ? store.nodes.find((n) => n.id === controllerId)
    : undefined;
  const colRows = patchVideoRowsPrompt(
    (col?.data as { rows?: StoryProVideoRow[] } | undefined)?.rows,
    rowKey,
    args.dockText,
  );
  if (col && colRows) store.updateNodeData(col.id, { rows: colRows });

  const hub = store.nodes.find((n) => n.id === args.scriptHubId);
  const hubRows = patchVideoRowsPrompt(
    (hub?.data as StoryProScriptHubNodeData | undefined)?.scriptStudioVideoRows,
    rowKey,
    args.dockText,
  );
  if (hubRows) {
    store.updateNodeData(args.scriptHubId, { scriptStudioVideoRows: hubRows });
  }

  if (args.reconcileEdges === false) return;
  const referenced = referencedVideoAssetNodeIds(args.dockText, args.index);
  for (const id of args.extraAssetNodeIds ?? []) {
    if (!referenced.includes(id)) referenced.push(id);
  }
  const allAssets = new Set(args.index.byNodeId.keys());
  useCanvasStore
    .getState()
    .setEdges((prev) =>
      reconcileVideoCellAssetEdges(prev, args.cellId, referenced, allAssets),
    );
}

export function listHubVideoCells(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): Array<{ cell: CanvasFlowNode; shotIndex: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out: Array<{ cell: CanvasFlowNode; shotIndex: number }> = [];
  for (const n of nodes) {
    if (n.type !== "sbv1-video-engine") continue;
    const d = n.data as {
      pro2MediaRole?: string;
      pro2ControllerNodeId?: string;
      pro2RowKey?: string;
    };
    if (d.pro2MediaRole !== "video" || !d.pro2ControllerNodeId?.trim()) continue;
    if (nodeHubId(n, byId) !== scriptHubId) continue;
    const shotIndex = Number(d.pro2RowKey);
    if (!Number.isFinite(shotIndex)) continue;
    out.push({ cell: n, shotIndex });
  }
  return out;
}

function applyPromptToVideoCell(args: {
  scriptHubId: string;
  cellId: string;
  shotIndex: number;
  prompt: string;
  refTokenIds: string[];
  index: WizardVideoAssetIndex;
}): string {
  const dockText = wizardPromptToVideoDock(args.prompt, args.index);
  const extraAssetNodeIds = args.refTokenIds
    .map((t) => args.index.byToken.get(t))
    .filter((id): id is string => Boolean(id));
  writeVideoCellDockPrompt({
    scriptHubId: args.scriptHubId,
    cellId: args.cellId,
    shotIndex: args.shotIndex,
    dockText,
    index: args.index,
    extraAssetNodeIds,
    writeNode: true,
  });
  return dockText;
}

/** 剧本创作改了分镜视频提示词 → 单个视频格（补引用 + 重连资产边）；返回写入的 Dock 文本 */
export function pushWizardVideoPromptToCell(args: {
  scriptHubId: string;
  cellId: string;
  shotIndex: number;
  wizardPrompt: string;
}): string | null {
  const { nodes } = useCanvasStore.getState();
  const hub = nodes.find((n) => n.id === args.scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return null;
  const hubData = hub.data as StoryProScriptHubNodeData;
  const { prompt, refTokenIds } = hydrateWizardVideoPrompt(
    hubData,
    args.shotIndex,
    args.wizardPrompt,
  );
  if (!prompt.trim()) return null;
  return applyPromptToVideoCell({
    scriptHubId: args.scriptHubId,
    cellId: args.cellId,
    shotIndex: args.shotIndex,
    prompt,
    refTokenIds,
    index: buildWizardVideoAssetIndex(nodes, args.scriptHubId, hubData),
  });
}

/** 载入画布末尾：视频格提示词 / 参考资产 ← 剧本创作「分镜视频」 */
export function applyWizardVideoPromptsToCells(scriptHubId: string): void {
  const { nodes } = useCanvasStore.getState();
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return;
  const hubData = hub.data as StoryProScriptHubNodeData;
  const index = buildWizardVideoAssetIndex(nodes, scriptHubId, hubData);

  for (const { cell, shotIndex } of listHubVideoCells(nodes, scriptHubId)) {
    const { prompt, refTokenIds } = resolveWizardVideoShotPrompt(
      hubData,
      shotIndex,
    );
    if (!prompt.trim()) continue;
    applyPromptToVideoCell({
      scriptHubId,
      cellId: cell.id,
      shotIndex,
      prompt,
      refTokenIds,
      index,
    });
  }
}
