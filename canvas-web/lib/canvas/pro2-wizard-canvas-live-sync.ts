"use client";

/**
 * 剧本创作（生产向导 draft）⇄ 已放入画布的节点 · 实时双向同步
 *
 * - 媒体：画布节点出图/出视频（OSS 稳定链）→ 向导 draft + Hub 行表；
 *   向导出图 → Hub 行表 → 画布节点（由 mount*PreviewToHub 负责）。
 * - 提示词：节点 Dock ⇄ 向导 draft.prompt，按「哪一侧自上次同步后变化」决定方向，
 *   @ 引用在 @<wiz-*> 与 @<ref-*> 之间转换。
 */
import type { Pro2ProductionScript } from "./data/pro2-production-script-schema";
import {
  convertDockRefsToWizardMentionTokens,
  convertWizardMentionTokensToDockRefs,
} from "./pro2-production-wizard-frame-mount";
import type { Pro2WizardAssetKind } from "./pro2-production-wizard-assets";
import { wizardAssetDraftKey } from "./pro2-production-wizard-assets";
import {
  shotRowKey,
  wizardShotDraftKey,
  type Pro2WizardShotMediaKind,
} from "./pro2-production-wizard-shot-drafts";
import { isPro2DockInputPinned } from "./pro2-dock-input-pin";
import { patchProductionWizardAssetDraft } from "./pro2-wizard-asset-draft-patch";
import { patchProductionWizardShotDraft } from "./pro2-wizard-shot-draft-patch";
import {
  sceneRowKeysEquivalent,
  storyProSceneRowKey,
} from "./story-pro-scene-asset-catalog";
import type {
  StoryProFrameRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import { useCanvasStore } from "./store";
import { isUnstableTaskMediaUrl } from "./task-media-url";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";

const LIVE_SYNC_DEBOUNCE_MS = 150;
/** 拖拽标志异常残留时最多推迟约 3s，避免同步停摆 */
const MAX_DRAG_DEFERRALS = 20;

type LinkKind = Pro2WizardAssetKind | Pro2WizardShotMediaKind;

type WizardCanvasLink = {
  nodeId: string;
  hubId: string;
  kind: LinkKind;
  /** 资产 id（character / scene / prop） */
  assetId?: string;
  /** 镜号（frame / video） */
  shotIndex?: number;
  controllerId?: string;
};

type PromptEntry = { wiz: string; node: string };

type NodeLike = {
  ossUrl?: string;
  uploading?: boolean;
  runtime?: CanvasNodeRuntime;
  dockInput?: string;
  prompt?: string;
  pro2MediaRole?: string;
  pro2RowKey?: string;
  pro2HubNodeId?: string;
  hubNodeId?: string;
  pro2ControllerNodeId?: string;
  scriptStudioSourceRowKey?: string;
};

function isAssetKind(kind: LinkKind): kind is Pro2WizardAssetKind {
  return kind === "character" || kind === "scene" || kind === "prop";
}

function httpUrl(raw: string | undefined): string {
  const u = raw?.trim() ?? "";
  return /^https?:\/\//i.test(u) ? u : "";
}

function readHub(hubId: string): {
  hub: CanvasFlowNode;
  data: StoryProScriptHubNodeData;
} | null {
  const hub = useCanvasStore.getState().nodes.find((n) => n.id === hubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return null;
  return { hub, data: hub.data as StoryProScriptHubNodeData };
}

function resolveSceneIdForRowKey(
  script: Pro2ProductionScript,
  hubData: StoryProScriptHubNodeData,
  hubId: string,
  rowKey: string,
): string | undefined {
  const rowName = hubData.sceneRows?.find((r) =>
    sceneRowKeysEquivalent(r.key, rowKey),
  )?.name;
  return script.scenes?.find(
    (s) =>
      sceneRowKeysEquivalent(rowKey, storyProSceneRowKey(hubId, s.name)) ||
      (rowName !== undefined && rowName === s.name),
  )?.id;
}

function classifyNode(
  node: CanvasFlowNode,
  byId: Map<string, CanvasFlowNode>,
  hubs: Map<string, StoryProScriptHubNodeData>,
): WizardCanvasLink | null {
  const d = node.data as NodeLike;
  const role = d.pro2MediaRole;
  let kind: LinkKind | null = null;
  let key = "";

  if (
    node.type === "story-pro2-three-view" ||
    (node.type === "story-pro2-image" && role === "character-three-view")
  ) {
    kind = "character";
    key = d.pro2RowKey?.trim() ?? "";
  } else if (node.type === "story-pro2-image" && role === "scene") {
    kind = "scene";
    key = d.pro2RowKey?.trim() ?? "";
  } else if (
    node.type === "story-pro2-image" &&
    role === "frame" &&
    d.pro2ControllerNodeId?.trim()
  ) {
    kind = "frame";
    key = d.pro2RowKey?.trim() ?? "";
  } else if (node.type === "story-pro2-prop") {
    kind = "prop";
    key = d.scriptStudioSourceRowKey?.trim() ?? "";
  } else if (
    node.type === "sbv1-video-engine" &&
    role === "video" &&
    d.pro2ControllerNodeId?.trim()
  ) {
    kind = "video";
    key = d.pro2RowKey?.trim() ?? "";
  }
  if (!kind || !key) return null;

  const controllerId = d.pro2ControllerNodeId?.trim() || undefined;
  const controller = controllerId ? byId.get(controllerId) : undefined;
  const hubId =
    d.pro2HubNodeId?.trim() ||
    d.hubNodeId?.trim() ||
    (controller?.data as { hubNodeId?: string } | undefined)?.hubNodeId?.trim() ||
    "";
  const hubData = hubs.get(hubId);
  const script = hubData?.productionScript as Pro2ProductionScript | undefined;
  if (!hubData || !script) return null;

  if (kind === "frame" || kind === "video") {
    const shotIndex = Number(key);
    if (!Number.isFinite(shotIndex)) return null;
    if (!script.shots?.some((s) => s.index === shotIndex)) return null;
    return { nodeId: node.id, hubId, kind, shotIndex, controllerId };
  }
  if (kind === "character") {
    if (!script.characters?.some((c) => c.id === key)) return null;
    return { nodeId: node.id, hubId, kind, assetId: key, controllerId };
  }
  if (kind === "prop") {
    if (!script.props?.some((p) => p.id === key)) return null;
    return { nodeId: node.id, hubId, kind, assetId: key, controllerId };
  }
  const sceneId = resolveSceneIdForRowKey(script, hubData, hubId, key);
  if (!sceneId) return null;
  return { nodeId: node.id, hubId, kind, assetId: sceneId, controllerId };
}

/** null = 生成中（不参与同步）；"" = 无媒体 */
function nodeMediaUrl(node: CanvasFlowNode, kind: LinkKind): string | null {
  const d = node.data as NodeLike;
  const status = d.runtime?.status;
  if (
    d.uploading ||
    status === "pending" ||
    status === "running" ||
    status === "queued"
  ) {
    return null;
  }
  if (kind === "video") {
    return httpUrl(d.runtime?.ossUrl) || httpUrl(d.runtime?.ephemeralUrl);
  }
  return (
    httpUrl(d.ossUrl) ||
    httpUrl(d.runtime?.ossUrl) ||
    httpUrl(d.runtime?.ephemeralUrl)
  );
}

function nodePromptText(node: CanvasFlowNode, kind: LinkKind): string {
  const d = node.data as NodeLike;
  if (kind === "video") {
    return String(d.prompt ?? "").trim() ? String(d.prompt) : String(d.dockInput ?? "");
  }
  return String(d.dockInput ?? "");
}

function readDraft(
  link: WizardCanvasLink,
  hubData: StoryProScriptHubNodeData,
): { previewUrl?: string; prompt?: string; generateStatus?: string } | undefined {
  if (isAssetKind(link.kind)) {
    return hubData.productionWizardAssetDrafts?.[
      wizardAssetDraftKey(link.kind, link.assetId!)
    ];
  }
  return hubData.productionWizardShotDrafts?.[
    wizardShotDraftKey(link.kind, link.shotIndex!)
  ];
}

function patchDraft(
  link: WizardCanvasLink,
  patch: Record<string, unknown>,
): void {
  if (isAssetKind(link.kind)) {
    patchProductionWizardAssetDraft(link.hubId, link.kind, link.assetId!, patch);
    return;
  }
  patchProductionWizardShotDraft(link.hubId, link.kind, link.shotIndex!, patch);
}

function syncLinkMedia(
  link: WizardCanvasLink,
  node: CanvasFlowNode,
  lastMedia: Map<string, string>,
): void {
  const url = nodeMediaUrl(node, link.kind);
  if (url === null) return;
  const prev = lastMedia.get(link.nodeId);
  lastMedia.set(link.nodeId, url);
  if (!url || isUnstableTaskMediaUrl(url)) return;

  const hub = readHub(link.hubId);
  if (!hub) return;
  const draft = readDraft(link, hub.data);
  const draftUrl = draft?.previewUrl?.trim();
  if (draftUrl === url) return;
  if (prev === undefined && draftUrl) return;
  if (prev === url) return;

  const runtime = (node.data as NodeLike).runtime;
  patchDraft(link, {
    previewUrl: url,
    taskId: runtime?.taskId?.trim() || undefined,
    failMessage: undefined,
    ...(draft?.generateStatus === "running" ? {} : { generateStatus: "idle" }),
  });
}

function patchRowsPrompt<T extends { key: string }>(
  rows: T[] | undefined,
  rowKey: string,
  field: "prompt" | "videoPrompt",
  text: string,
): T[] | null {
  if (!rows?.length) return null;
  let changed = false;
  const next = rows.map((r) => {
    if (r.key !== rowKey) return r;
    if ((r as Record<string, unknown>)[field] === text) return r;
    changed = true;
    return { ...r, [field]: text };
  });
  return changed ? next : null;
}

/** 写画布侧提示词：节点 Dock + 分镜/视频列行 + Hub 行表（防止后续 rows→节点同步回退） */
function writeCanvasPrompt(
  link: WizardCanvasLink,
  text: string,
  opts: { writeNode: boolean },
): void {
  const { nodes, updateNodeData } = useCanvasStore.getState();
  const node = nodes.find((n) => n.id === link.nodeId);
  if (!node) return;

  if (isAssetKind(link.kind)) {
    if (opts.writeNode) {
      updateNodeData(link.nodeId, { dockInput: text, pro2DockInputPinned: true });
    } else if (!isPro2DockInputPinned(node)) {
      updateNodeData(link.nodeId, { pro2DockInputPinned: true });
    }
    return;
  }

  const rowKey = shotRowKey(link.shotIndex!);
  if (link.kind === "frame") {
    if (opts.writeNode) updateNodeData(link.nodeId, { dockInput: text });
    const col = link.controllerId
      ? nodes.find((n) => n.id === link.controllerId)
      : undefined;
    const colRows = patchRowsPrompt(
      (col?.data as { rows?: StoryProFrameRow[] } | undefined)?.rows,
      rowKey,
      "prompt",
      text,
    );
    if (col && colRows) updateNodeData(col.id, { rows: colRows });
    const hub = readHub(link.hubId);
    const hubRows = patchRowsPrompt(
      hub?.data.scriptStudioFrameRows,
      rowKey,
      "prompt",
      text,
    );
    if (hubRows) updateNodeData(link.hubId, { scriptStudioFrameRows: hubRows });
    return;
  }

  if (opts.writeNode) {
    updateNodeData(link.nodeId, { dockInput: text, prompt: text });
  }
  const col = link.controllerId
    ? nodes.find((n) => n.id === link.controllerId)
    : undefined;
  const colRows = patchRowsPrompt(
    (col?.data as { rows?: StoryProVideoRow[] } | undefined)?.rows,
    rowKey,
    "videoPrompt",
    text,
  );
  if (col && colRows) updateNodeData(col.id, { rows: colRows });
  const hub = readHub(link.hubId);
  const hubRows = patchRowsPrompt(
    hub?.data.scriptStudioVideoRows,
    rowKey,
    "videoPrompt",
    text,
  );
  if (hubRows) updateNodeData(link.hubId, { scriptStudioVideoRows: hubRows });
}

function syncLinkPrompt(
  link: WizardCanvasLink,
  node: CanvasFlowNode,
  lastPrompt: Map<string, PromptEntry>,
): void {
  const hub = readHub(link.hubId);
  if (!hub) return;
  const script = hub.data.productionScript as Pro2ProductionScript | undefined;
  const sceneRows = hub.data.sceneRows ?? [];
  const nodeText = nodePromptText(node, link.kind);
  const wiz = readDraft(link, hub.data)?.prompt ?? "";

  const entry = lastPrompt.get(link.nodeId);
  if (!entry) {
    lastPrompt.set(link.nodeId, { wiz, node: nodeText });
    return;
  }

  if (nodeText !== entry.node) {
    entry.node = nodeText;
    entry.wiz = wiz;
    if (!nodeText.trim()) return;
    const asWiz = convertDockRefsToWizardMentionTokens(
      nodeText,
      script,
      link.hubId,
      sceneRows,
    );
    if (asWiz !== wiz) {
      patchDraft(link, { prompt: asWiz });
      entry.wiz = asWiz;
    }
    writeCanvasPrompt(link, nodeText, { writeNode: false });
    return;
  }

  if (wiz !== entry.wiz) {
    entry.wiz = wiz;
    if (!wiz.trim()) return;
    const asDock = convertWizardMentionTokensToDockRefs(
      wiz,
      script,
      link.hubId,
      sceneRows,
    );
    if (asDock !== nodeText) {
      writeCanvasPrompt(link, asDock, { writeNode: true });
      entry.node = asDock;
    }
  }
}

function runLiveSyncPass(
  lastMedia: Map<string, string>,
  lastPrompt: Map<string, PromptEntry>,
): void {
  const { nodes } = useCanvasStore.getState();
  const hubs = new Map<string, StoryProScriptHubNodeData>();
  for (const n of nodes) {
    if (n.type !== "story-pro2-script-hub") continue;
    const data = n.data as StoryProScriptHubNodeData;
    if (data.productionScript) hubs.set(n.id, data);
  }
  if (!hubs.size) {
    lastMedia.clear();
    lastPrompt.clear();
    return;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const links: WizardCanvasLink[] = [];
  for (const n of nodes) {
    const link = classifyNode(n, byId, hubs);
    if (link) links.push(link);
  }

  const seen = new Set<string>();
  for (const link of links) {
    seen.add(link.nodeId);
    const node = useCanvasStore
      .getState()
      .nodes.find((n) => n.id === link.nodeId);
    if (!node) continue;
    syncLinkMedia(link, node, lastMedia);
    const fresh =
      useCanvasStore.getState().nodes.find((n) => n.id === link.nodeId) ?? node;
    syncLinkPrompt(link, fresh, lastPrompt);
  }

  for (const id of [...lastMedia.keys()]) {
    if (!seen.has(id)) lastMedia.delete(id);
  }
  for (const id of [...lastPrompt.keys()]) {
    if (!seen.has(id)) lastPrompt.delete(id);
  }
}

/** 画布页挂载一次；返回卸载函数 */
export function installPro2WizardCanvasLiveSync(): () => void {
  const lastMedia = new Map<string, string>();
  const lastPrompt = new Map<string, PromptEntry>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let dragDeferrals = 0;

  const flush = () => {
    timer = null;
    if (disposed) return;
    const s = useCanvasStore.getState();
    if (
      (s.canvasGeometryDragging || s.canvasDraggingNodeId) &&
      dragDeferrals < MAX_DRAG_DEFERRALS
    ) {
      dragDeferrals += 1;
      schedule();
      return;
    }
    dragDeferrals = 0;
    runLiveSyncPass(lastMedia, lastPrompt);
  };

  const schedule = () => {
    if (timer || disposed) return;
    timer = setTimeout(flush, LIVE_SYNC_DEBOUNCE_MS);
  };

  const unsubscribe = useCanvasStore.subscribe((state, prev) => {
    if (state.nodes !== prev.nodes) schedule();
  });
  schedule();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}

export const __test__ = { runLiveSyncPass, classifyNode };
