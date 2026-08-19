"use client";

import { useCallback, useEffect, useRef } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  isCanvasApiAccessDeniedError,
  cancelCanvasGenerationTask,
  listCanvasProjectTasks,
  markCanvasProjectTasksForbidden,
  runCanvasNode,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import { useCanvasStore } from "./store";
import { flushCanvasGraphPersistBounded } from "./canvas-graph-persist-bridge";
import { isCanvasSaveInFlight } from "./canvas-project-version-sync";
import { buildCanvasRunSnapshot } from "./canvas-run-snapshot";
import { refreshSbv1UpstreamPortraitStatuses } from "./refresh-sbv1-upstream-portrait";
import { resolveSbv1VideoEngineInputs, resolveSbv1VideoEngineEffectivePrompt } from "./resolve-sbv1-video-engine-inputs";
import {
  dockInputModeToPatch,
  getSbv1VideoDockModeChips,
  resolveSbv1DockInputMode,
  sbv1VideoModelUsesPortraitLibrary,
} from "@/lib/canvas/sbv1-video-model-reference";
import {
  resolvePortraitAssetRefsFromUpstream,
} from "./resolve-portrait-asset-refs";
import { materializeImageInputsForRun } from "./materialize-image-inputs-for-run";
import { resolveHdGridSplitImageInputs } from "./resolve-hd-grid-split-image-inputs";
import { directPredecessors } from "./topo";
import { dockMentionRefUrlsForPrompt } from "./dock-mention-ref-urls";
import { parseReferencedIds } from "./dock-mention-parse";
import type { StoryRefImage } from "./story-ref-image";
import { resolvePro2DockUpstreamLinks } from "./pro2-dock-upstream-links";
import { findStyleAssetLinkedToImage } from "./pro2-style-asset-connect";
import { pro2DockMentionRefCatalog, resolveDockRefsForRun } from "./pro2-dock-ref-catalog";
import { resolveDockRunPrompt, resolveSbv1VideoEngineRunPrompt } from "./resolve-dock-run-prompt";
import { resolveSbv1UpstreamRefLinks } from "./sbv1-upstream-ref-links";
import { resolveSbv1UpstreamTextLinks } from "./sbv1-upstream-text-links";
import { buildSbv1VideoEngineDockUpstreamLinks } from "./sbv1-dock-mentionables";
import { resolvePro2VideoBoardCellDockLinks } from "./pro2-video-board-dock-links";
import { collectRefImageUrlsFromGridNode } from "./ref-video-edges";
import { isRefGridNodeType } from "./ref-video-models";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasNodeRuntime,
  ImageNodeData,
  ImageEngineNodeData,
  TextNodeData,
  AiEngineNodeData,
  StoryEngineNodeData,
  StoryComicStarterNodeData,
} from "./types";
import { isStoryLlmNodeType } from "./types";
import {
  isAnyStoryCharacterColumnType,
  isAnyStoryFrameColumnType,
  isAnyStorySceneColumnType,
  isAnyStoryScriptHubType,
  isAnyStoryVideoColumnType,
} from "./story-workspace-resolver";
import { sceneRowKeysEquivalent } from "./story-pro-scene-asset-catalog";
import { formatCanvasTaskError, resolveLibtvRunFailureCode } from "./friendly-task-error";
import { maybeNotifyCanvasCreditsSettled, markCanvasNodeGenerationStarted } from "./canvas-credits-notify";
import { clearCanvasNodeRunSession } from "./canvas-run-session";
import { canvasIdleRuntimeAfterUserCancel } from "./canvas-generation-cancel-messages";
import {
  isCanvasTaskTerminalStatus,
  notifyCanvasTaskPanelSync,
  subscribeCanvasTasksChanged,
} from "./canvas-panel-sync-events";
import {
  registerCanvasRunBus,
  type CanvasCancelGenerationJob,
  type CanvasStoryRunJob,
  unregisterCanvasRunBus,
} from "./canvas-run-bus";
import {
  countCanvasInflightWork,
  collectCanvasInflightNodeIds,
  collectCanvasTaskPollNodeIds,
} from "./story-column-runtime";
import { reconcileStaleInflightRuntimes } from "./story-inflight-reconcile";
import { resolveStoryHubSectionTextInputs } from "./story-hub-text-inputs";
import { resolveStoryProStarterScriptInput } from "./story-pro-starter-text";
import {
  commitStoryRunCancelLocal,
  commitStoryRunPendingPatch,
  storyApplyTaskResult,
} from "./story-run-apply";
import {
  sbv1ImageFailurePatch,
  sbv1ImagePatchFromTask,
  sbv1VideoPatchFromTask,
  isSameSbv1MediaDataPatch,
} from "./sbv1-image-task-apply";
import {
  libtvAudioPatchFromTask,
  isSameLibtvAudioDataPatch,
  type LibtvAudioNodeData,
} from "./libtv-audio-task-apply";
import {
  commitLibtvMediaRunPendingPatch,
  isLibtvFreestandingImageNode,
  resolveLibtvImageEngineFromNodeData,
} from "./libtv-image-node-run";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import { resolveStoryProRunStylePayload } from "./story-pro-run-style-context";
import { commitStoryVideoRowRun } from "./story-video-run";
import type {
  StoryRunContext,
  StoryVideoColumnNodeData,
} from "./story-workspace-types";
import { isStoryWorkspaceNodeType } from "./types";
import {
  hubSectionIsComplete,
  hubSectionHasTerminalError,
  hubSectionNeedsRun,
  hubSectionRuntime,
  shouldSkipHubSectionInflightTaskApply,
} from "./story-hub-runtime";
import { isCanvasInflightStatus } from "./story-column-runtime";
import {
  storyLlmNodeIsComplete,
  storyLlmNodeNeedsRun,
} from "./story-llm-runtime";
import {
  isLikelyVideoUrl,
  pickRuntimeImagePreviewUrl,
  pickRuntimeVideoUrl,
  pickTaskImagePreviewUrl,
  pickTaskModelDownloadUrl,
  pickTaskResultMediaUrl,
} from "./task-media-url";
import {
  backfillFrameVideoRuntimesFromTasks,
  pickPreferredCanvasTask,
  pickPreferredCanvasTaskForScope,
  pickStoryRowApplyTask,
  preferredTasksByNode,
  runtimePatchFromCanvasTask,
  shouldApplyCanvasTaskRuntimePatch,
  shouldSkipStoryRowTaskApply,
  storyRunContextFromScope,
} from "./task-pick";
import {
  ingestCanvasProjectTasks,
  markCanvasProjectTasksPoolForbidden,
} from "./use-node-task-history";
import { restoreServerInflightNodeRuntimes } from "./restore-server-inflight-node-runtimes";
import {
  findPro2CharacterThreeViewNodeForRow,
  findPro2FrameImageNodeForRow,
  maybeClearHubPendingSceneSyncGroup,
  reconcilePro2ThreeViewNodesWithColumnRows,
} from "./pro2-group-row-resolve";
import { syncPro2CharacterImagesFromRows } from "./pro2-spawn-character-image-group";
import { characterRowsNeedingThreeViewNodeSync } from "./pro2-group-row-resolve";
import type { StoryProCharacterRow } from "./story-pro-workspace-types";
import {
  CANVAS_POLL_IDLE_RECHECK_MS,
  CANVAS_POLL_MEDIA_RENDER_BACKOFF_MS,
  nextPollIntervalMs,
} from "./poll-interval";
import { hasAnyMediaRenderInFlight } from "./media-render-in-flight";

/** 打开画布后尽快全量任务扫描，刷新后恢复服务端在飞任务（原 5s 会导致生成态短暂消失） */
const INITIAL_FULL_SCAN_DELAY_MS = 300;
/** 首 tick 略延后，避免与 hydrate / fitView 同帧抢主线程 */
const INITIAL_TICK_DELAY_MS = 200;
/** 每 N 次 tick 做一次全项目任务扫描，避免刷新后 runtime 丢失导致轮询停住 */
const FULL_SCAN_EVERY_N_TICKS = 3;

function syncPro2CharacterGroupImagesFromColumnRuntimes(
  nodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  for (const node of nodes) {
    if (!isAnyStoryCharacterColumnType(node.type ?? "")) continue;
    const rows = (node.data as { rows?: StoryProCharacterRow[] }).rows ?? [];
    if (!rows.length) continue;
    const rowsToSync = characterRowsNeedingThreeViewNodeSync(rows);
    if (rowsToSync.length) {
      syncPro2CharacterImagesFromRows(
        nodes,
        node.id,
        rowsToSync,
        updateNodeData,
        { inflightOnly: true },
      );
    }
    reconcilePro2ThreeViewNodesWithColumnRows(nodes, node.id, updateNodeData);
  }
}

function canvasStoryRunJobKey(job: CanvasStoryRunJob): string {
  const parts = [job.nodeId];
  if (job.llmSection) parts.push(job.llmSection);
  if (job.rowKey) parts.push(job.rowKey);
  if (job.mediaKind) parts.push(job.mediaKind);
  return parts.join(":");
}

/** 模块级别名：作业唯一键。放模块作用域，避免 hook 内引用被 eslint 误判为缺失依赖。 */
const runKey = canvasStoryRunJobKey;

function nodeRuntimeStatus(node: CanvasFlowNode): string | undefined {
  return (node.data as { runtime?: { status?: string } }).runtime?.status;
}

function isLocalInflightStatus(status?: string): boolean {
  return status === "queued" || status === "pending" || status === "running";
}

function isServerInflightStatus(status?: string): boolean {
  return (
    status === "QUEUED" ||
    status === "DISPATCHING" ||
    status === "PENDING" ||
    status === "SUBMITTED"
  );
}

type StoryRowJob = Pick<CanvasStoryRunJob, "rowKey" | "mediaKind" | "llmSection">;

function storyRowRuntimeStatus(
  node: CanvasFlowNode | undefined,
  job: StoryRowJob,
): string | undefined {
  if (!node || !job.rowKey) return undefined;
  const rowKey = job.rowKey;
  const rows = (
    node.data as {
      rows?: {
        key: string;
        runtime?: { status?: string };
        videoRuntime?: { status?: string };
        ttsRuntime?: { status?: string };
      }[];
    }
  ).rows;
  const row = rows?.find((r) =>
    isAnyStorySceneColumnType(node.type ?? "")
      ? sceneRowKeysEquivalent(r.key, rowKey)
      : r.key === rowKey,
  );
  if (!row) return undefined;
  if (isAnyStoryVideoColumnType(node.type ?? "")) {
    return job.mediaKind === "tts"
      ? row.ttsRuntime?.status
      : row.videoRuntime?.status;
  }
  return row.runtime?.status;
}

function shouldReleaseStoryRunInflight(
  node: CanvasFlowNode | undefined,
  job: StoryRowJob & { nodeId?: string; llmSection?: string },
): boolean {
  if (node && isAnyStoryScriptHubType(node.type ?? "") && job.llmSection) {
    return hubSectionIsComplete(node, job.llmSection);
  }
  if (
    node &&
    (node.type === "story-pro2-starter" ||
      node.type === "story-pro-starter" ||
      (node.type === "story-pro2-script-hub" &&
        (node.data as { scriptStudioMode?: boolean }).scriptStudioMode ===
          true)) &&
    (job.mediaKind === "themeOutline" || job.mediaKind === "generalText")
  ) {
    const st = (
      node.data as { themeOutlineRuntime?: { status?: string } }
    ).themeOutlineRuntime?.status;
    return st === "done" || st === "error";
  }
  if (job.rowKey && node && isStoryWorkspaceNodeType(node.type ?? "")) {
    const st = storyRowRuntimeStatus(node, job);
    return st === "done" || st === "error";
  }
  if (node && isStoryLlmNodeType(node.type ?? "")) {
    const st = nodeRuntimeStatus(node);
    return st === "done" || st === "error";
  }
  if (node) {
    const st = nodeRuntimeStatus(node);
    return st === "done" || st === "error";
  }
  return true;
}

function latestTasksByNode(
  tasks: CanvasTaskRecord[],
  nodes: CanvasFlowNode[],
): Map<string, CanvasTaskRecord> {
  return preferredTasksByNode(tasks, nodes);
}

/** 顶部工具栏：进行中的生成任务数（含漫剧行级 / 文案段） */
export function useCanvasInflightTaskCount(): number {
  return useCanvasStore((s) => countCanvasInflightWork(s.nodes));
}

/** 解析单个生图/视频引擎节点上游的图片 URL 列表（保持顺序去重）。 */
function resolveImageInputsRaw(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  const self = nodes.find((n) => n.id === nodeId);
  if (
    self?.type === "story-pro2-image" &&
    (self.data as { pro2HdFromGridSplit?: boolean }).pro2HdFromGridSplit
  ) {
    return [];
  }

  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "image") {
      const d = p.data as unknown as ImageNodeData;
      if (d.ossUrl) out.push(d.ossUrl);
    } else if (
      p.type === "sbv1-image" ||
      p.type === "story-pro2-image" ||
      p.type === "story-pro2-three-view"
    ) {
      const d = p.data as { ossUrl?: string; blobUrl?: string };
      const url = d.ossUrl ?? d.blobUrl;
      if (url) out.push(url);
    } else if (p.type === "story-pro2-style-asset") {
      const d = p.data as { imageUrl?: string };
      if (d.imageUrl?.trim()) out.push(d.imageUrl.trim());
    } else if (isRefGridNodeType(p.type ?? "")) {
      out.push(...collectRefImageUrlsFromGridNode(p));
    } else if (p.type === "image-engine" || p.type === "three-view-engine") {
      const d = p.data as unknown as ImageEngineNodeData;
      const url =
        pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ?? d.runtime?.ossUrl;
      if (url) out.push(url);
    } else if (p.type === "tts-engine") {
      const d = p.data as unknown as { runtime?: { ossUrl?: string } };
      if (d.runtime?.ossUrl) out.push(d.runtime.ossUrl);
    } else if (p.type === "sbv1-video-engine" || p.type === "video-engine") {
      const d = p.data as {
        runtime?: { ossUrl?: string; ephemeralUrl?: string };
        ossUrl?: string;
        blobUrl?: string;
        videoUrl?: string;
        modelKey?: string;
      };
      const videoUrl =
        pickRuntimeVideoUrl(d.runtime) ??
        [d.runtime?.ossUrl, d.ossUrl, d.blobUrl, d.videoUrl]
          .map((u) => String(u ?? "").trim())
          .find((u) => u && isLikelyVideoUrl(u));
      if (videoUrl) {
        out.push(videoUrl);
      } else {
        const preview =
          pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ?? d.runtime?.ossUrl;
        if (preview) out.push(preview);
      }
    }
  }
  return Array.from(new Set(out));
}

function promptForDockMentionFilter(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  rowKey?: string,
): string {
  const d = node.data as Record<string, unknown>;
  if (node.type === "sbv1-video-engine") {
    return String(d.prompt ?? "");
  }
  if (node.type === "sbv1-image") {
    return String(d.dockInput ?? "");
  }
  if (node.type === "story-pro2-starter") {
    return String(d.themeInput ?? "");
  }
  if (node.type === "story-pro2-script-hub") {
    return String(d.dockInput ?? "");
  }
  if (
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view"
  ) {
    return String(d.dockInput ?? "");
  }
  if (node.type === "story-pro2-audio") {
    return String(d.dockInput ?? "");
  }
  if (rowKey && isStoryWorkspaceNodeType(node.type ?? "")) {
    const rows = (d.rows as { key?: string; prompt?: string }[] | undefined) ?? [];
    const row = rows.find((r) => r.key === rowKey);
    if (row?.prompt) return String(row.prompt);
    const imageNode =
      isAnyStoryCharacterColumnType(node.type ?? "")
        ? findPro2CharacterThreeViewNodeForRow(nodes, node.id, rowKey)
        : isAnyStoryFrameColumnType(node.type ?? "")
          ? findPro2FrameImageNodeForRow(nodes, node.id, rowKey)
          : nodes.find(
              (n) =>
                (n.type === "story-pro2-image" ||
                  n.type === "story-pro2-three-view") &&
                (n.data as { pro2ControllerNodeId?: string; pro2RowKey?: string })
                  .pro2ControllerNodeId === node.id &&
                (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey,
            );
    if (imageNode) {
      return String(
        (imageNode.data as { dockInput?: string }).dockInput ?? "",
      );
    }
  }
  return "";
}

function mentionCatalogForNode(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  rowKey?: string,
): { id: string; url?: string }[] {
  if (node.type === "sbv1-video-engine") {
    return resolveSbv1UpstreamRefLinks(node.id, nodes, edges).map((l) => ({
      id: l.id,
      url: l.previewUrl,
    }));
  }
  if (node.type === "sbv1-image") {
    const links = resolvePro2DockUpstreamLinks(
      node.id,
      "sbv1-image",
      nodes,
      edges,
    );
    const dockRefImages = (
      (node.data as { dockRefImages?: StoryRefImage[] }).dockRefImages ?? []
    ) as StoryRefImage[];
    return pro2DockMentionRefCatalog(links, dockRefImages);
  }

  if (
    node.type === "story-pro2-starter" ||
    node.type === "story-pro2-script-hub" ||
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view"
  ) {
    const nodeType = node.type ?? "";
    const dockRefImages = (
      (node.data as { dockRefImages?: StoryRefImage[] }).dockRefImages ?? []
    ) as StoryRefImage[];
    const links = resolvePro2DockUpstreamLinks(
      node.id,
      nodeType,
      nodes,
      edges,
    );
    return pro2DockMentionRefCatalog(links, dockRefImages);
  }

  if (rowKey && isStoryWorkspaceNodeType(node.type ?? "")) {
    const imageNode =
      isAnyStoryCharacterColumnType(node.type ?? "")
        ? findPro2CharacterThreeViewNodeForRow(nodes, node.id, rowKey)
        : isAnyStoryFrameColumnType(node.type ?? "")
          ? findPro2FrameImageNodeForRow(nodes, node.id, rowKey)
          : nodes.find(
              (n) =>
                (n.type === "story-pro2-image" ||
                  n.type === "story-pro2-three-view") &&
                (n.data as { pro2ControllerNodeId?: string; pro2RowKey?: string })
                  .pro2ControllerNodeId === node.id &&
                (n.data as { pro2RowKey?: string }).pro2RowKey === rowKey,
            );
    if (imageNode) {
      const d = imageNode.data as {
        dockRefImages?: StoryRefImage[];
      };
      const links = resolvePro2DockUpstreamLinks(
        imageNode.id,
        imageNode.type ?? "",
        nodes,
        edges,
      );
      return pro2DockMentionRefCatalog(links, d.dockRefImages ?? []);
    }
  }

  return [];
}

function resolveImageInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
  opts?: { prompt?: string; rowKey?: string },
): string[] {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  const nodeType = node.type ?? "";
    if (
    nodeType === "story-pro2-image" &&
    (node.data as { pro2HdFromGridSplit?: boolean }).pro2HdFromGridSplit
  ) {
    const d = node.data as {
      gridSplitCrop?: unknown;
      ossUrl?: string;
      blobUrl?: string;
      dockRefImages?: StoryRefImage[];
      gridSplitFrameCrop?: boolean;
    };
    if (d.gridSplitCrop) return [];
    const urls: string[] = [];
    const selfOss = d.ossUrl?.trim();
    const selfBlob = d.blobUrl?.trim();
    if (selfOss && /^https?:\/\//.test(selfOss)) urls.push(selfOss);
    else if (selfBlob) urls.push(selfBlob);
    for (const ref of d.dockRefImages ?? []) {
      const u = ref.url?.trim();
      if (u && !urls.includes(u)) urls.push(u);
    }
    return urls;
  }

  const prompt =
    opts?.prompt ??
    promptForDockMentionFilter(node, nodes, edges, opts?.rowKey);
  const raw = resolveImageInputsRaw(nodes, edges, nodeId);
  const dockImageTypes = new Set([
    "sbv1-image",
    "story-pro2-image",
    "story-pro2-three-view",
  ]);
  if (!dockImageTypes.has(nodeType)) {
    const catalog = mentionCatalogForNode(node, nodes, edges, opts?.rowKey);
    if (!catalog.length) return raw;
    const fromCatalog = dockMentionRefUrlsForPrompt(prompt, catalog);
    return Array.from(new Set([...fromCatalog, ...raw]));
  }

  const links = resolvePro2DockUpstreamLinks(nodeId, nodeType, nodes, edges);
  const dockRefImages = (
    (node.data as { dockRefImages?: StoryRefImage[] }).dockRefImages ?? []
  ) as StoryRefImage[];
  const mentioned = parseReferencedIds(prompt);
  if (mentioned.length > 0) {
    const refs = resolveDockRefsForRun(prompt, links, dockRefImages);
    const urls = refs
      .map((r) => r.url)
      .filter((u): u is string => typeof u === "string" && Boolean(u.trim()));
    return Array.from(new Set(urls));
  }

  const catalog = pro2DockMentionRefCatalog(links, dockRefImages);
  if (!catalog.length) return raw;
  return dockMentionRefUrlsForPrompt(prompt, catalog);
}

function resolveSbv1ImageRunData(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  data: Record<string, unknown>,
): Record<string, unknown> {
  const styleNode = findStyleAssetLinkedToImage(nodes, edges, node.id);
  if (!styleNode) return data;
  const sd = styleNode.data as {
    presetId?: string;
    styleName?: string;
    stylePrompt?: string;
    styleAnchorZh?: string;
    imageUrl?: string;
  };
  return {
    ...data,
    dockStyleRef: {
      presetId: sd.presetId,
      name: sd.styleName,
      prompt: sd.stylePrompt ?? sd.styleAnchorZh,
      imageUrl: sd.imageUrl,
    },
  };
}

/** ai-engine / story LLM 完成时，把 textOutput 写入下游 text / md-preview 依赖的 text 节点 */
function propagateTextOutputToDownstream(
  nodeId: string,
  textOutput: string,
  setNodeRuntime: (id: string, runtime: Partial<{ textOutput: string }>) => void,
) {
  const state = useCanvasStore.getState();
  const downstream: string[] = state.edges
    .filter((e) => e.source === nodeId)
    .map((e) => e.target);
  for (const tid of downstream) {
    const t = state.nodes.find((n) => n.id === tid);
    if (!t) continue;
    if (t.type !== "text") continue;
    const td = t.data as unknown as TextNodeData;
    if (td.mode === "manual" && (td.text ?? "").trim()) continue;
    setNodeRuntime(tid, { textOutput });
  }
}

/** @deprecated alias */
function propagateAiOutputToDownstreamText(
  nodeId: string,
  textOutput: string,
  setNodeRuntime: (id: string, runtime: Partial<{ textOutput: string }>) => void,
) {
  propagateTextOutputToDownstream(nodeId, textOutput, setNodeRuntime);
}

function applyLibtvAudioTaskResult(
  node: CanvasFlowNode,
  task: CanvasTaskRecord,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  if (node.type !== "story-pro2-audio") return false;
  const patch = libtvAudioPatchFromTask(
    (node.data ?? {}) as LibtvAudioNodeData,
    task,
  );
  if (!patch) return false;
  if (isSameLibtvAudioDataPatch(node.data as Record<string, unknown>, patch)) {
    return true;
  }
  updateNodeData(node.id, patch);
  return true;
}

function propagateMusicResultToDownstreamAudio(
  sourceNodeId: string,
  task: CanvasTaskRecord,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  const mediaUrl = pickTaskResultMediaUrl(task) ?? task.ossUrl ?? undefined;
  if (!mediaUrl) return;
  const { nodes, edges } = useCanvasStore.getState();
  for (const e of edges) {
    if (e.source !== sourceNodeId) continue;
    const tgt = nodes.find((n) => n.id === e.target);
    if (!tgt || tgt.type !== "story-pro2-audio") continue;
    const patch = libtvAudioPatchFromTask(
      (tgt.data ?? {}) as LibtvAudioNodeData,
      { ...task, status: "SUCCEEDED", ossUrl: mediaUrl },
    );
    if (patch) updateNodeData(tgt.id, patch);
  }
}

function applySbv1ImageTaskResult(
  node: CanvasFlowNode,
  task: CanvasTaskRecord,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  if (!isLibtvFreestandingImageNode(node)) return false;
  const patch = sbv1ImagePatchFromTask(
    node.data as unknown as Sbv1ImageNodeData,
    task,
  );
  if (!patch) return false;
  if (isSameSbv1MediaDataPatch(node.data as Record<string, unknown>, patch)) {
    maybeClearHubPendingSceneSyncGroup(
      useCanvasStore.getState().nodes,
      node.id,
      updateNodeData,
    );
    return true;
  }
  updateNodeData(node.id, patch);
  maybeClearHubPendingSceneSyncGroup(
    useCanvasStore.getState().nodes.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n,
    ),
    node.id,
    updateNodeData,
  );
  return true;
}

function applySbv1VideoTaskResult(
  node: CanvasFlowNode,
  task: CanvasTaskRecord,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  if (node.type !== "sbv1-video-engine") return false;
  const patch = sbv1VideoPatchFromTask(task);
  if (!patch) return false;
  if (isSameSbv1MediaDataPatch(node.data as Record<string, unknown>, patch)) {
    return true;
  }
  updateNodeData(node.id, patch);
  return true;
}

function modelKeyFromCanvasNode(
  node: CanvasFlowNode | undefined,
): string | undefined {
  if (!node) return undefined;
  const d = node.data as {
    engine?: { modelKey?: string };
    modelKey?: string;
  };
  return d.engine?.modelKey?.trim() || d.modelKey?.trim() || undefined;
}

/** 独立节点顺序跑（宫格高清等）· 单节点失败不阻断后续 */
function isIndependentCanvasNodeJob(job: CanvasStoryRunJob): boolean {
  return !job.rowKey && !job.llmSection && !job.mediaKind;
}

function shouldAdvanceSequentialAfterHubFailure(
  node: CanvasFlowNode | undefined,
  job: CanvasStoryRunJob,
): boolean {
  if (!node || !job.llmSection || !isAnyStoryScriptHubType(node.type ?? "")) {
    return false;
  }
  return hubSectionHasTerminalError(node, job.llmSection);
}

function advanceSequentialAfterNodeError(
  job: CanvasStoryRunJob,
  key: string,
  finishSequentialStep: (completedKey: string) => void,
  abortSequentialOnError: (completedKey: string) => void,
): void {
  if (isIndependentCanvasNodeJob(job)) {
    finishSequentialStep(key);
    return;
  }
  abortSequentialOnError(key);
}

function applyLibtvMediaRunFailure(
  node: CanvasFlowNode | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  failCode: string,
  failMessage: string,
): boolean {
  if (!node) return false;
  clearCanvasNodeRunSession(node.id);
  const modelKey = modelKeyFromCanvasNode(node);
  if (isLibtvFreestandingImageNode(node) || node.type === "sbv1-video-engine" || node.type === "story-pro2-audio") {
    updateNodeData(node.id, sbv1ImageFailurePatch(failCode, failMessage, modelKey));
    return true;
  }
  return false;
}

/** @deprecated use applyLibtvMediaRunFailure */
function applySbv1ImageRunFailure(
  node: CanvasFlowNode | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  failCode: string,
  failMessage: string,
): boolean {
  return applyLibtvMediaRunFailure(node, updateNodeData, failCode, failMessage);
}

/** 解析单个节点的 textInputs（按入边出现顺序拼接）。 */
function resolveTextInputs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string[] {
  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "text") {
      const d = p.data as unknown as TextNodeData;
      // 双向文本：piped 模式优先用 runtime.textOutput；否则用 d.text
      if (d.mode === "piped" && d.runtime?.textOutput?.trim()) {
        out.push(d.runtime.textOutput.trim());
      } else if (d.text?.trim()) {
        out.push(d.text.trim());
      }
    } else if (p.type === "ai-engine" || isStoryLlmNodeType(p.type ?? "")) {
      const d = p.data as unknown as AiEngineNodeData | StoryEngineNodeData;
      if (d.runtime?.textOutput?.trim()) out.push(d.runtime.textOutput.trim());
    } else if (p.type === "story-comic-starter") {
      const d = p.data as unknown as StoryComicStarterNodeData;
      const sp = d.systemPrompt?.trim() || d.theme?.trim();
      if (sp) out.push(sp);
    } else if (p.type === "story-pro2-starter") {
      const d = p.data as import("./story-pro-workspace-types").StoryProStarterNodeData;
      const script = resolveStoryProStarterScriptInput(nodes, edges, pid);
      if (script) out.push(script);
      if (d.generatedOutlineMd?.trim()) out.push(d.generatedOutlineMd.trim());
      if (d.themeInput?.trim() && !d.generatedOutlineMd?.trim()) {
        out.push(d.themeInput.trim());
      }
    } else if (p.type === "story-pro-starter") {
      const d = p.data as import("./story-pro-workspace-types").StoryProStarterNodeData;
      const script = resolveStoryProStarterScriptInput(nodes, edges, pid);
      if (script) out.push(script);
      if (d.generatedOutlineMd?.trim()) out.push(d.generatedOutlineMd.trim());
      if (d.themeInput?.trim() && !d.generatedOutlineMd?.trim()) {
        out.push(d.themeInput.trim());
      }
      if (d.systemPrompt?.trim()) {
        out.push(`## 导演提示词\n\n${d.systemPrompt.trim()}`);
      }
    } else if (p.type === "story-pro2-tag") {
      const d = p.data as { body?: string };
      if (d.body?.trim()) out.push(d.body.trim());
    } else if (isAnyStoryScriptHubType(p.type ?? "")) {
      const d = p.data as {
        outlineMd?: string;
        characterMd?: string;
        storyboardMd?: string;
      };
      for (const part of [d.outlineMd, d.characterMd, d.storyboardMd]) {
        if (part?.trim()) out.push(part.trim());
      }
    }
  }
  return out;
}

/**
 * 运行队列 + 5s 任务轮询 hook。
 * 在 canvas page 挂载一次即可。
 */
export function useCanvasRunner(
  fallbackProjectId?: string,
  opts?: {
    gatewayLinkBlocked?: boolean;
    gatewayLinkAccountUrl?: string | null;
  },
) {
  const base = useBookMallBaseUrl();
  const gatewayLinkBlocked = opts?.gatewayLinkBlocked ?? false;
  const gatewayLinkAccountUrl = opts?.gatewayLinkAccountUrl ?? null;
  const storeProjectId = useCanvasStore((s) => s.projectId);
  const projectId = storeProjectId ?? fallbackProjectId ?? null;
  const setNodeRuntime = useCanvasStore((s) => s.setNodeRuntime);

  type QueueItem = CanvasStoryRunJob;

  const queueRef = useRef<QueueItem[]>([]);
  const inflightRef = useRef<Set<string>>(new Set());
  /** forceFresh 时若同 key 仍在跑，等当前 runOne 结束后再替换执行 */
  const deferredForceFreshRef = useRef<Map<string, QueueItem>>(new Map());
  const taskByNodeRef = useRef<Map<string, string>>(new Map());
  const jobByTaskRef = useRef<Map<string, QueueItem>>(new Map());
  const terminalNotifiedRef = useRef<Set<string>>(new Set());
  const sequentialRef = useRef<{
    jobs: QueueItem[];
    cursor: number;
    forceFresh?: boolean;
    activeKey: string | null;
  } | null>(null);

  const emitTaskPanelSync = useCallback(
    (
      task: Pick<CanvasTaskRecord, "id" | "status">,
      opts?: { created?: boolean; flushAutosave?: boolean },
    ) => {
      if (!projectId) return;
      const terminal = isCanvasTaskTerminalStatus(task.status);
      if (terminal) {
        const dedupeKey = `${task.id}:${task.status}`;
        if (terminalNotifiedRef.current.has(dedupeKey) && !opts?.flushAutosave) {
          return;
        }
        terminalNotifiedRef.current.add(dedupeKey);
      }
      notifyCanvasTaskPanelSync({
        projectId,
        taskId: task.id,
        status: task.status,
        terminal,
        created: opts?.created,
      });
      if (opts?.flushAutosave && task.status === "SUCCEEDED") {
        // 不在此全量/轻量拉项目：连接池紧张时会刷 Failed to fetch 红屏；
        // 保存遇 409 时由 autosave 自行轻量对齐 updatedAt。
        window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
      }
    },
    [projectId],
  );

  /** 新 run 开始前解绑旧 taskId，避免轮询把上一轮成功任务写回 runtime */
  const detachNodeTaskRefs = useCallback((job: QueueItem) => {
    const nodeId = job.nodeId;
    const key = runKey(job);
    for (const [k, tid] of Array.from(taskByNodeRef.current.entries())) {
      if (k === key || k === nodeId || k.startsWith(`${nodeId}:`)) {
        jobByTaskRef.current.delete(tid);
        taskByNodeRef.current.delete(k);
      }
    }
  }, []);

  const drainRef = useRef<() => void>(() => {});
  const pumpSequentialRef = useRef<() => void>(() => {});
  /** 入队后立即触发任务轮询，避免等 INITIAL_TICK_DELAY 才同步服务端态 */
  const pollKickRef = useRef<(() => void) | null>(null);

  const releaseInflightKey = useCallback((key: string) => {
    if (!inflightRef.current.delete(key)) return;
    const deferred = deferredForceFreshRef.current.get(key);
    deferredForceFreshRef.current.delete(key);
    if (deferred) {
      queueRef.current.push(deferred);
      setTimeout(() => drainRef.current(), 0);
    }
  }, []);

  /** 顺序链单步完成：防止 subscribe 与 finally 重复推进 cursor */
  const finishSequentialStep = useCallback((completedKey: string) => {
    const seq = sequentialRef.current;
    if (!seq || seq.activeKey !== completedKey) return;
    seq.activeKey = null;
    seq.cursor += 1;
    pumpSequentialRef.current();
  }, []);

  const abortSequentialOnError = useCallback((completedKey: string) => {
    const seq = sequentialRef.current;
    if (!seq || seq.activeKey !== completedKey) return;
    seq.activeKey = null;
    sequentialRef.current = null;
  }, []);

  const updateNodeData = useCanvasStore((s) => s.updateNodeData);

  const abortSequential = useCallback(
    (job?: QueueItem, message?: string) => {
      if (job?.nodeId && message) {
        const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
        if (node && isStoryWorkspaceNodeType(node.type ?? "")) {
          storyApplyTaskResult(
            node,
            {
              id: "",
              nodeId: job.nodeId,
              kind: "TEXT",
              status: "FAILED",
              model: "",
              ossUrl: null,
              ephemeralUrl: null,
              textOutput: null,
              failCode: "RUN_ABORTED",
              failMessage: message,
              submittedAt: null,
              completedAt: null,
              kieTaskId: null,
              createdAt: "",
              updatedAt: "",
            },
            job,
            updateNodeData,
            useCanvasStore.getState().nodes,
          );
        } else if (job.nodeId) {
          const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
          if (
            !applySbv1ImageRunFailure(
              node,
              updateNodeData,
              "RUN_ABORTED",
              message,
            )
          ) {
            const modelKey = modelKeyFromCanvasNode(node);
            setNodeRuntime(job.nodeId, {
              status: "error",
              failCode: "RUN_ABORTED",
              failMessage: formatCanvasTaskError(
                "RUN_ABORTED",
                message,
                modelKey,
              ),
            });
          }
        }
      }
      if (job && isIndependentCanvasNodeJob(job)) {
        const seq = sequentialRef.current;
        if (seq) {
          const key = runKey(job);
          if (seq.activeKey === key) {
            seq.activeKey = null;
            seq.cursor += 1;
            pumpSequentialRef.current();
          }
        }
        return;
      }
      sequentialRef.current = null;
    },
    [setNodeRuntime, updateNodeData],
  );

  const pumpSequential = useCallback(() => {
    const seq = sequentialRef.current;
    if (!seq) return;
    if (seq.cursor >= seq.jobs.length) {
      sequentialRef.current = null;
      return;
    }
    if (seq.activeKey) return;

    const job = seq.jobs[seq.cursor];
    if (!job) {
      sequentialRef.current = null;
      return;
    }
    const key = runKey(job);
    const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
    if (!node) {
      if (isIndependentCanvasNodeJob(job)) {
        seq.cursor += 1;
        seq.activeKey = null;
        pumpSequential();
        return;
      }
      abortSequential(job, "找不到节点，请刷新页面或重新创建工作区");
      return;
    }

    if (
      !seq.forceFresh &&
      isAnyStoryScriptHubType(node.type ?? "") &&
      job.llmSection &&
      hubSectionIsComplete(node, job.llmSection)
    ) {
      seq.cursor += 1;
      seq.activeKey = null;
      pumpSequential();
      return;
    }
    if (
      !seq.forceFresh &&
      isStoryLlmNodeType(node.type ?? "") &&
      nodeRuntimeStatus(node) === "done" &&
      !storyLlmNodeNeedsRun(node, false)
    ) {
      seq.cursor += 1;
      seq.activeKey = null;
      pumpSequential();
      return;
    }

    seq.activeKey = key;
    detachNodeTaskRefs(job);
    markCanvasNodeGenerationStarted(job.nodeId);
    const nodesNow = useCanvasStore.getState().nodes;
    if (
      !commitStoryRunPendingPatch(node, job, nodesNow, updateNodeData) &&
      !commitLibtvMediaRunPendingPatch(node, updateNodeData)
    ) {
      setNodeRuntime(job.nodeId, {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
      });
    }
    queueRef.current.push({ ...job, forceFresh: seq.forceFresh });
    drainRef.current();
    pollKickRef.current?.();
  }, [abortSequential, setNodeRuntime, updateNodeData, detachNodeTaskRefs]);

  useEffect(() => {
    pumpSequentialRef.current = pumpSequential;
  }, [pumpSequential]);

  /** createTask 返回 SUBMITTED 后立刻拉 /tasks（含读道 TEXT recover），缩短 Gateway 成功与 UI 对齐延迟 */
  const syncInflightTaskAfterSubmit = useCallback(
    (nodeId: string, job: QueueItem) => {
      pollKickRef.current?.();
      if (!base || !projectId) return;

      const applyTasks = (tasks: CanvasTaskRecord[] | null) => {
        if (tasks == null) return;
        ingestCanvasProjectTasks(projectId, tasks);
        const nodeTasks = tasks.filter((t) => t.nodeId === nodeId);
        if (!nodeTasks.length) return;
        const node = useCanvasStore.getState().nodes.find((x) => x.id === nodeId);
        if (!node) return;
        const nodes = useCanvasStore.getState().nodes;

        if (isAnyStoryScriptHubType(node.type ?? "")) {
          for (const section of [
            "outline",
            "character",
            "scene",
            "storyboard",
          ] as const) {
            const scope = { llmSection: section };
            const localRt = hubSectionRuntime(node, section);
            const pick = pickPreferredCanvasTaskForScope(
              nodeTasks,
              scope,
              localRt,
              nodeId,
            );
            if (!pick) continue;
            const ctx: CanvasStoryRunJob =
              jobByTaskRef.current.get(pick.id) ??
              storyRunContextFromScope(nodeId, scope);
            if (shouldSkipStoryRowTaskApply(localRt, pick, nodeId)) continue;
            storyApplyTaskResult(node, pick, ctx, updateNodeData, nodes);
          }
          return;
        }

        const scope = {
          rowKey: job.rowKey,
          mediaKind: job.mediaKind,
          llmSection: job.llmSection,
        };
        let localRt = (node.data as { runtime?: CanvasNodeRuntime }).runtime;
        if (job.rowKey) {
          const rows =
            (
              node.data as {
                rows?: {
                  key: string;
                  runtime?: CanvasNodeRuntime;
                  videoRuntime?: CanvasNodeRuntime;
                  ttsRuntime?: CanvasNodeRuntime;
                }[];
              }
            ).rows ?? [];
          const row = rows.find((r) => r.key === job.rowKey);
          if (row) {
            localRt =
              job.mediaKind === "video"
                ? row.videoRuntime
                : job.mediaKind === "tts"
                  ? row.ttsRuntime
                  : row.runtime;
          }
        }
        const pick =
          job.rowKey && (job.mediaKind || job.llmSection)
            ? pickStoryRowApplyTask(nodeTasks, scope, localRt)
            : job.rowKey || job.mediaKind || job.llmSection
              ? pickPreferredCanvasTaskForScope(nodeTasks, scope, localRt, nodeId)
              : pickPreferredCanvasTask(nodeTasks, { localRuntime: localRt, nodeId });
        if (!pick) return;

        if (isStoryWorkspaceNodeType(node.type ?? "")) {
          storyApplyTaskResult(node, pick, job, updateNodeData, nodes);
          return;
        }
        if (isLibtvFreestandingImageNode(node)) {
          if (shouldSkipStoryRowTaskApply(localRt, pick, nodeId)) return;
          const patch = sbv1ImagePatchFromTask(
            node.data as unknown as Sbv1ImageNodeData,
            pick,
          );
          if (
            patch &&
            !isSameSbv1MediaDataPatch(
              node.data as Record<string, unknown>,
              patch,
            )
          ) {
            updateNodeData(nodeId, patch);
          }
          return;
        }
        if (node.type === "sbv1-video-engine") {
          if (shouldSkipStoryRowTaskApply(localRt, pick, nodeId)) return;
          const patch = sbv1VideoPatchFromTask(pick);
          if (
            patch &&
            !isSameSbv1MediaDataPatch(
              node.data as Record<string, unknown>,
              patch,
            )
          ) {
            updateNodeData(nodeId, patch);
          }
          return;
        }
        const patch = runtimePatchFromCanvasTask(pick);
        if (
          patch &&
          shouldApplyCanvasTaskRuntimePatch(localRt, pick, patch, nodeId)
        ) {
          setNodeRuntime(nodeId, patch);
        }
      };

      void listCanvasProjectTasks(base, projectId, [nodeId])
        .then(applyTasks)
        .catch(() => {});
      window.setTimeout(() => {
        void listCanvasProjectTasks(base, projectId, [nodeId])
          .then(applyTasks)
          .catch(() => {});
        pollKickRef.current?.();
      }, 800);
    },
    [base, projectId, updateNodeData, setNodeRuntime],
  );

  const runOne = useCallback(
    async (job: QueueItem) => {
      const key = runKey(job);
      const { nodeId, forceFresh } = job;
      markCanvasNodeGenerationStarted(nodeId);
      try {
        if (!base || !projectId) {
          abortSequential(job, "画布未就绪，请刷新页面后重试");
          return;
        }
        const state = useCanvasStore.getState();
        const node = state.nodes.find((n) => n.id === nodeId);
        if (!node) {
          abortSequential(job, "找不到该节点，请刷新页面");
          return;
        }

        let imageInputs = resolveImageInputs(state.nodes, state.edges, nodeId, {
          rowKey: job.rowKey,
        });
        let portraitAssetRefs: ReturnType<
          typeof resolvePortraitAssetRefsFromUpstream
        > = [];
        let sbv1VideoResolved: ReturnType<
          typeof resolveSbv1VideoEngineInputs
        > | null = null;
        if (node.type === "sbv1-video-engine") {
          const vdPre = node.data as {
            engine?: { modelKey?: string; providerId?: string };
          };
          const engineModelKey = vdPre.engine?.modelKey?.trim() ?? "";
          const engineProviderId = vdPre.engine?.providerId?.trim() ?? "";
          if (
            base &&
            projectId &&
            sbv1VideoModelUsesPortraitLibrary(engineModelKey, engineProviderId)
          ) {
            await refreshSbv1UpstreamPortraitStatuses({
              base,
              engineNodeId: nodeId,
              nodes: useCanvasStore.getState().nodes,
              edges: useCanvasStore.getState().edges,
              updateNodeData,
              projectId,
            });
          }
          const stateAfterPortrait = useCanvasStore.getState();
          const nodeAfterPortrait =
            stateAfterPortrait.nodes.find((n) => n.id === nodeId) ?? node;
          const vd = nodeAfterPortrait.data as {
            prompt?: string;
            dockInput?: string;
            referenceMode?: string;
            engine?: { modelKey?: string; providerId?: string };
          };
          const effectivePrompt = resolveSbv1VideoEngineEffectivePrompt(
            nodeId,
            stateAfterPortrait.nodes,
            stateAfterPortrait.edges,
          );
          const resolved = resolveSbv1VideoEngineInputs(
            stateAfterPortrait.nodes,
            stateAfterPortrait.edges,
            nodeId,
            {
              prompt: effectivePrompt,
              referenceMode:
                vd.referenceMode === "first_last" ||
                vd.referenceMode === "smart_multi"
                  ? vd.referenceMode
                  : "omni",
              dockInputMode: (vd as { dockInputMode?: string }).dockInputMode as
                | import("./sbv1-workspace-types").Sbv1DockInputMode
                | undefined,
              modelKey: vd.engine?.modelKey?.trim() || undefined,
              providerId: vd.engine?.providerId?.trim() || undefined,
            },
          );
          if (!resolved.ok) {
            abortSequential(job, resolved.error);
            return;
          }
          sbv1VideoResolved = resolved;
          imageInputs = resolved.imageInputs;
          portraitAssetRefs = resolved.portraitAssetRefs;
        } else {
          portraitAssetRefs = resolvePortraitAssetRefsFromUpstream(
            state.nodes,
            state.edges,
            nodeId,
          );
        }
        const textInputs = resolveStoryHubSectionTextInputs(
          node,
          job.llmSection,
          resolveTextInputs(state.nodes, state.edges, nodeId),
        );
        let mergedTextInputs = textInputs;
        if (
          job.rowKey &&
          (job.mediaKind === "threeView" ||
            job.mediaKind === "sceneRef" ||
            job.mediaKind === "frameImage")
        ) {
          mergedTextInputs = [];
        }

        const data = node.data as Record<string, unknown>;
        let runData = isLibtvFreestandingImageNode(node)
          ? resolveSbv1ImageRunData(node, state.nodes, state.edges, data)
          : data;

        if (
          node.type === "sbv1-image" ||
          node.type === "story-pro2-image" ||
          node.type === "story-pro2-three-view"
        ) {
          const links = resolvePro2DockUpstreamLinks(
            nodeId,
            node.type ?? "",
            state.nodes,
            state.edges,
          );
          const dockPrompt = String(
            (runData as { dockInput?: string }).dockInput ?? "",
          );
          const { prompt: cleanedPrompt, extraText } = resolveDockRunPrompt(
            dockPrompt,
            links,
          );
          if (cleanedPrompt !== dockPrompt) {
            runData = { ...runData, dockInput: cleanedPrompt };
          }
          if (extraText.length) {
            mergedTextInputs = [...extraText, ...mergedTextInputs];
          }
        }
        if (node.type === "sbv1-video-engine") {
          const latestState = useCanvasStore.getState();
          const latestNodes = latestState.nodes;
          const latestEdges = latestState.edges;
          const vdForPrompt =
            latestNodes.find((n) => n.id === nodeId)?.data ?? node.data;
          const boardLinks =
            (vdForPrompt as { pro2MediaRole?: string; pro2ControllerNodeId?: string })
              .pro2MediaRole === "video" &&
            Boolean(
              (
                vdForPrompt as { pro2ControllerNodeId?: string }
              ).pro2ControllerNodeId?.trim(),
            )
              ? resolvePro2VideoBoardCellDockLinks(
                  nodeId,
                  latestNodes,
                  latestEdges,
                )
              : [];
          const upstreamForMention = buildSbv1VideoEngineDockUpstreamLinks(
            resolveSbv1UpstreamRefLinks(nodeId, latestNodes, latestEdges),
            resolveSbv1UpstreamTextLinks(nodeId, latestNodes, latestEdges),
            boardLinks,
          );
          const effectivePrompt = resolveSbv1VideoEngineEffectivePrompt(
            nodeId,
            latestNodes,
            latestEdges,
          );
          const runPrompt = resolveSbv1VideoEngineRunPrompt(
            effectivePrompt,
            upstreamForMention,
          );
          if (runPrompt) {
            runData = {
              ...runData,
              prompt: runPrompt,
              dockInput: runPrompt,
            };
          }
          const vdRun = runData as import("./sbv1-workspace-types").Sbv1VideoEngineNodeData;
          const mk = vdRun.engine?.modelKey?.trim() ?? "";
          if (mk) {
            const chips = getSbv1VideoDockModeChips(mk, {
              providerId: vdRun.engine?.providerId,
              multiShots: vdRun.engine?.params?.multi_shots === true,
            });
            const mode = resolveSbv1DockInputMode(
              vdRun.referenceMode ?? "omni",
              vdRun.dockInputMode,
              chips,
            );
            if (mode !== vdRun.dockInputMode) {
              runData = {
                ...runData,
                ...dockInputModeToPatch(mode),
              };
            }
          }
        }
        if (
          sbv1VideoResolved?.ok &&
          sbv1VideoResolved.videoInputs.length > 0
        ) {
          const eng = (runData.engine as Record<string, unknown> | undefined) ?? {};
          const prevParams =
            (eng.params as Record<string, unknown> | undefined) ??
            (runData.params as Record<string, unknown> | undefined) ??
            {};
          const mergedParams = {
            ...prevParams,
            reference_video_urls: sbv1VideoResolved.videoInputs,
          };
          runData = {
            ...runData,
            params: mergedParams,
            engine: { ...eng, params: mergedParams },
          };
        }
        if (isLibtvFreestandingImageNode(node)) {
          if (!resolveLibtvImageEngineFromNodeData(runData)) {
            abortSequential(
              job,
              "缺少 IMAGE 模型配置，请在输入坞「图片生成设置」中选择生图模型",
            );
            return;
          }
        }
        const modelKey =
          typeof data.modelKey === "string" ? data.modelKey : undefined;
        const stylePayload = resolveStoryProRunStylePayload(
          state.nodes,
          state.edges,
          node,
        );

        if (
          job.mediaKind === "video" &&
          job.rowKey &&
          isAnyStoryVideoColumnType(node.type ?? "")
        ) {
          const vd = node.data as StoryVideoColumnNodeData;
          const frameColumnId = vd.frameColumnId;
          const batchVideo = vd.batchVideo;
          if (
            !frameColumnId ||
            !batchVideo?.providerId?.trim() ||
            !batchVideo?.modelKey?.trim()
          ) {
            abortSequential(
              job,
              "分镜视频列未关联分镜列或未选择视频模型，无法生成。",
            );
            return;
          }
          const vr = await commitStoryVideoRowRun({
            base,
            projectId,
            videoColumnId: nodeId,
            frameColumnId,
            rowKey: job.rowKey,
            batchVideo: {
              providerId: batchVideo.providerId,
              modelKey: batchVideo.modelKey,
              params: batchVideo.params ?? {},
            },
            forceFresh,
          });
          if (!vr.ok) {
            abortSequential(job, vr.error);
            return;
          }
          if (vr.taskId) {
            taskByNodeRef.current.set(key, vr.taskId);
            jobByTaskRef.current.set(vr.taskId, job);
          }
          return;
        }

        const latestForInputs = useCanvasStore.getState();
        const nodeForInputs =
          latestForInputs.nodes.find((n) => n.id === nodeId) ?? node;
        const inputData = nodeForInputs.data as {
          pro2HdFromGridSplit?: boolean;
          gridSplitCrop?: import("./libtv-grid-split-crop").GridSplitCrop;
          gridSplitFrameCrop?: boolean;
          gridSplitSourceUrl?: string;
          ossUrl?: string;
          blobUrl?: string;
        };

        const precroppedOss = inputData.ossUrl?.trim();
        const hasPrecroppedHdRef =
          nodeForInputs.type === "story-pro2-image" &&
          inputData.pro2HdFromGridSplit &&
          inputData.gridSplitFrameCrop &&
          !inputData.gridSplitCrop &&
          Boolean(precroppedOss && /^https?:\/\//.test(precroppedOss));

        if (hasPrecroppedHdRef) {
          imageInputs = [precroppedOss!];
          runData = {
            ...runData,
            ossUrl: precroppedOss,
            blobUrl: undefined,
            gridSplitCrop: undefined,
            gridSplitFrameCrop: true,
          };
        } else if (
          nodeForInputs.type === "story-pro2-image" &&
          inputData.pro2HdFromGridSplit &&
          inputData.gridSplitCrop &&
          base &&
          projectId
        ) {
          const sourceUrl = String(inputData.gridSplitSourceUrl ?? "").trim();
          const serverWillPrepare = /^https?:\/\//.test(sourceUrl);
          if (serverWillPrepare) {
            imageInputs = [];
          } else {
            try {
              imageInputs = await resolveHdGridSplitImageInputs(
                base,
                projectId,
                nodeId,
                inputData,
                updateNodeData,
              );
              const croppedUrl = imageInputs[0]?.trim();
              if (
                croppedUrl &&
                (runData as { pro2HdFromGridSplit?: boolean }).pro2HdFromGridSplit
              ) {
                runData = {
                  ...runData,
                  ossUrl: croppedUrl,
                  blobUrl: undefined,
                  gridSplitCrop: undefined,
                  gridSplitFrameCrop: true,
                };
              }
            } catch (e) {
              abortSequential(
                job,
                e instanceof Error ? e.message : "宫格裁切参考图失败",
              );
              return;
            }
          }
        } else {
          imageInputs = resolveImageInputs(
            latestForInputs.nodes,
            latestForInputs.edges,
            nodeId,
            { rowKey: job.rowKey },
          );
          if (base && imageInputs.some((u) => u.startsWith("blob:"))) {
            try {
              imageInputs = await materializeImageInputsForRun(
                base,
                imageInputs,
              );
              const ossUrl = imageInputs[0]?.trim();
              if (
                ossUrl &&
                /^https?:\/\//.test(ossUrl) &&
                (runData as { pro2HdFromGridSplit?: boolean })
                  .pro2HdFromGridSplit
              ) {
                const refId = `hd-ref-${nodeId}`;
                updateNodeData(nodeId, {
                  ossUrl,
                  blobUrl: undefined,
                  uploading: false,
                  mediaFitKey: ossUrl,
                  dockRefImages: [
                    { id: refId, label: "参考图", url: ossUrl },
                  ],
                });
              }
            } catch (e) {
              abortSequential(
                job,
                e instanceof Error
                  ? e.message
                  : "参考图上传 OSS 失败，无法发起图生图",
              );
              return;
            }
          }
        }

        if (
          node.type === "story-pro2-image" &&
          (runData as { pro2HdFromGridSplit?: boolean }).pro2HdFromGridSplit &&
          imageInputs.length === 0 &&
          !(
            inputData.gridSplitCrop &&
            /^https?:\/\//.test(String(inputData.gridSplitSourceUrl ?? ""))
          )
        ) {
          abortSequential(
            job,
            "高清参考图未就绪，无法发起图生图，请重新选择宫格并生成。",
          );
          return;
        }

        // 生成前尽量落盘；最多等 8s，避免 PATCH 挂死阻塞「生成」与「保存中」UI
        await flushCanvasGraphPersistBounded(8_000, true);

        const r = await runCanvasNode(base, projectId, nodeId, {
          node: {
            type: node.type ?? "image-engine",
            modelKey,
            data: runData,
            imageInputs,
            textInputs: mergedTextInputs,
            portraitAssetRefs,
          },
          forceFresh,
          llmSection: job.llmSection,
          rowKey: job.rowKey,
          mediaKind: job.mediaKind,
          canvasSnapshot: buildCanvasRunSnapshot(),
          ...stylePayload,
        });
        taskByNodeRef.current.set(key, r.task.id);
        jobByTaskRef.current.set(r.task.id, job);
        emitTaskPanelSync(r.task, {
          created: true,
          flushAutosave: r.task.status === "SUCCEEDED",
        });
        const nodesNow = useCanvasStore.getState().nodes;
        const nodeNow = nodesNow.find((n) => n.id === nodeId) ?? node;
        if (
          r.task.status === "SUCCEEDED" &&
          (r.task.textOutput || pickTaskResultMediaUrl(r.task))
        ) {
          if (
            nodeNow.type === "story-pro2-starter" &&
            job.mediaKind === "music"
          ) {
            propagateMusicResultToDownstreamAudio(
              nodeId,
              r.task,
              updateNodeData,
            );
            updateNodeData(nodeId, {
              themeOutlineRuntime: {
                status: "done",
                taskId: r.task.id,
                failCode: undefined,
                failMessage: undefined,
              },
            });
          } else if (applyLibtvAudioTaskResult(nodeNow, r.task, updateNodeData)) {
            /* audio node */
          } else if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
            storyApplyTaskResult(
              nodeNow,
              r.task,
              job,
              updateNodeData,
              nodesNow,
            );
          } else if (
            applySbv1ImageTaskResult(nodeNow, r.task, updateNodeData) ||
            applySbv1VideoTaskResult(nodeNow, r.task, updateNodeData) ||
            applyLibtvAudioTaskResult(nodeNow, r.task, updateNodeData)
          ) {
            /* ossUrl + runtime */
          } else {
            setNodeRuntime(nodeId, {
              status: "done",
              taskId: r.task.id,
              ossUrl:
                pickTaskResultMediaUrl(r.task) ?? r.task.ossUrl ?? undefined,
              ephemeralUrl: r.task.ephemeralUrl ?? undefined,
              textOutput: r.task.textOutput ?? undefined,
            });
            if (
              r.task.textOutput &&
              (nodeNow.type === "ai-engine" ||
                isStoryLlmNodeType(nodeNow.type ?? ""))
            ) {
              propagateTextOutputToDownstream(
                nodeId,
                r.task.textOutput,
                setNodeRuntime,
              );
            }
          }
          maybeNotifyCanvasCreditsSettled(r.task);
        } else if (r.task.status === "FAILED") {
          if (
            nodeNow.type === "story-pro2-starter" &&
            job.mediaKind === "music"
          ) {
            updateNodeData(nodeId, {
              themeOutlineRuntime: {
                status: "error",
                taskId: r.task.id,
                failCode: r.task.failCode ?? "FAILED",
                failMessage: formatCanvasTaskError(
                  r.task.failCode,
                  r.task.failMessage,
                  r.task.model,
                ),
              },
            });
          } else if (applyLibtvAudioTaskResult(nodeNow, r.task, updateNodeData)) {
            /* audio node */
          } else if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
            storyApplyTaskResult(
              nodeNow,
              r.task,
              job,
              updateNodeData,
              nodesNow,
            );
          } else if (
            applySbv1ImageTaskResult(nodeNow, r.task, updateNodeData) ||
            applySbv1VideoTaskResult(nodeNow, r.task, updateNodeData) ||
            applyLibtvAudioTaskResult(nodeNow, r.task, updateNodeData)
          ) {
            /* ossUrl + runtime */
          } else {
            const localRt = (nodeNow.data as { runtime?: CanvasNodeRuntime })
              .runtime;
            const errorPatch: Partial<CanvasNodeRuntime> = {
              status: "error",
              taskId: r.task.id,
              failCode: r.task.failCode ?? "FAILED",
              failMessage: formatCanvasTaskError(
                r.task.failCode,
                r.task.failMessage,
                r.task.model,
              ),
            };
            if (shouldApplyCanvasTaskRuntimePatch(localRt, r.task, errorPatch, nodeId)) {
              setNodeRuntime(nodeId, errorPatch);
            }
          }
        } else {
          if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
            storyApplyTaskResult(
              nodeNow,
              r.task,
              job,
              updateNodeData,
              nodesNow,
            );
          } else if (
            applySbv1ImageTaskResult(nodeNow, r.task, updateNodeData) ||
            applySbv1VideoTaskResult(nodeNow, r.task, updateNodeData) ||
            applyLibtvAudioTaskResult(nodeNow, r.task, updateNodeData)
          ) {
            /* pending / running */
          } else {
            setNodeRuntime(nodeId, {
              status: "running",
              taskId: r.task.id,
            });
          }
          syncInflightTaskAfterSubmit(nodeId, job);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const errState = useCanvasStore.getState();
        const errNode = errState.nodes.find((n) => n.id === nodeId);
        const isInflightConflict =
          msg.includes("409") &&
          (msg.includes("in progress") ||
            msg.includes("TASK_ALREADY_INFLIGHT"));
        if (isInflightConflict && base && projectId) {
          try {
            const tasks = await listCanvasProjectTasks(base, projectId, [nodeId]);
            const scoped = (tasks ?? []).filter((t) => t.nodeId === nodeId);
            const scope = {
              rowKey: job.rowKey,
              mediaKind: job.mediaKind,
              llmSection: job.llmSection,
            };
            const pick =
              job.rowKey || job.mediaKind || job.llmSection
                ? pickPreferredCanvasTaskForScope(scoped, scope)
                : pickPreferredCanvasTask(scoped);
            if (pick) {
              taskByNodeRef.current.set(key, pick.id);
              jobByTaskRef.current.set(pick.id, job);
              const nodeNow =
                useCanvasStore.getState().nodes.find((n) => n.id === nodeId) ??
                errNode;
              if (!nodeNow) return;
              if (
                nodeNow.type === "story-pro2-starter" &&
                job.mediaKind === "music" &&
                pick.status === "SUCCEEDED"
              ) {
                propagateMusicResultToDownstreamAudio(
                  nodeId,
                  pick,
                  updateNodeData,
                );
                updateNodeData(nodeId, {
                  themeOutlineRuntime: {
                    status: "done",
                    taskId: pick.id,
                    failCode: undefined,
                    failMessage: undefined,
                  },
                });
              } else if (
                nodeNow.type === "story-pro2-starter" &&
                job.mediaKind === "music" &&
                pick.status === "FAILED"
              ) {
                updateNodeData(nodeId, {
                  themeOutlineRuntime: {
                    status: "error",
                    taskId: pick.id,
                    failCode: pick.failCode ?? "FAILED",
                    failMessage: formatCanvasTaskError(
                      pick.failCode,
                      pick.failMessage,
                      pick.model,
                    ),
                  },
                });
              } else if (applyLibtvAudioTaskResult(nodeNow, pick, updateNodeData)) {
                /* audio node */
              } else if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
                storyApplyTaskResult(
                  nodeNow,
                  pick,
                  job,
                  updateNodeData,
                  useCanvasStore.getState().nodes,
                );
              } else if (
                applySbv1ImageTaskResult(nodeNow, pick, updateNodeData) ||
                applySbv1VideoTaskResult(nodeNow, pick, updateNodeData) ||
                applyLibtvAudioTaskResult(nodeNow, pick, updateNodeData)
              ) {
                /* ossUrl + runtime */
              } else if (
                pick.status === "SUCCEEDED" &&
                (pick.textOutput || pickTaskResultMediaUrl(pick))
              ) {
                setNodeRuntime(nodeId, {
                  status: "done",
                  taskId: pick.id,
                  ossUrl:
                    pickTaskResultMediaUrl(pick) ?? pick.ossUrl ?? undefined,
                  ephemeralUrl: pick.ephemeralUrl ?? undefined,
                  textOutput: pick.textOutput ?? undefined,
                });
              } else if (pick.status === "FAILED") {
                const localRt = (nodeNow.data as { runtime?: CanvasNodeRuntime })
                  .runtime;
                const errorPatch: Partial<CanvasNodeRuntime> = {
                  status: "error",
                  taskId: pick.id,
                  failCode: pick.failCode ?? "FAILED",
                  failMessage: formatCanvasTaskError(
                    pick.failCode,
                    pick.failMessage,
                    pick.model,
                  ),
                };
                if (shouldApplyCanvasTaskRuntimePatch(localRt, pick, errorPatch, nodeId)) {
                  setNodeRuntime(nodeId, errorPatch);
                }
              } else {
                setNodeRuntime(nodeId, {
                  status:
                    pick.status === "QUEUED" || pick.status === "PENDING"
                      ? "pending"
                      : "running",
                  taskId: pick.id,
                });
              }
              return;
            }
          } catch {
            /* fall through to error state */
          }
        }
        if (errNode && isStoryWorkspaceNodeType(errNode.type ?? "")) {
          storyApplyTaskResult(
            errNode,
            {
              id: "",
              nodeId,
              kind: "TEXT",
              status: "FAILED",
              model: "",
              ossUrl: null,
              ephemeralUrl: null,
              textOutput: null,
              failCode: "REQUEST_FAILED",
              failMessage: msg,
              submittedAt: null,
              completedAt: null,
              kieTaskId: null,
              createdAt: "",
              updatedAt: "",
            },
            job,
            updateNodeData,
            errState.nodes,
          );
        } else {
          const failCode = resolveLibtvRunFailureCode(msg);
          const modelKey = modelKeyFromCanvasNode(errNode);
          if (
            !applySbv1ImageRunFailure(errNode, updateNodeData, failCode, msg)
          ) {
            setNodeRuntime(nodeId, {
              status: "error",
              failCode,
              failMessage: formatCanvasTaskError(failCode, msg, modelKey),
            });
          }
        }
      } finally {
        const nodeAfter = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
        const taskStarted = taskByNodeRef.current.has(key);
        if (shouldReleaseStoryRunInflight(nodeAfter, job) || !taskStarted) {
          releaseInflightKey(key);
        }
        const seq = sequentialRef.current;
        if (seq?.activeKey === key) {
          const node = nodeAfter;
          let done = false;
          if (node && isAnyStoryScriptHubType(node.type ?? "") && job.llmSection) {
            done = hubSectionIsComplete(node, job.llmSection);
          } else if (node && isStoryLlmNodeType(node.type ?? "")) {
            done =
              nodeRuntimeStatus(node) === "done" &&
              storyLlmNodeIsComplete(node);
          } else if (node && job.rowKey) {
            const st = storyRowRuntimeStatus(node, job);
            done = st === "done" || st === "error";
          } else if (node) {
            done =
              nodeRuntimeStatus(node) === "done" ||
              nodeRuntimeStatus(node) === "error";
          }
          if (done) {
            const rowErr =
              job.rowKey &&
              node &&
              storyRowRuntimeStatus(node, job) === "error";
            if (rowErr && job.mediaKind === "sceneRef") {
              finishSequentialStep(key);
            } else if (
              rowErr ||
              (node && nodeRuntimeStatus(node) === "error") ||
              shouldAdvanceSequentialAfterHubFailure(node, job)
            ) {
              advanceSequentialAfterNodeError(
                job,
                key,
                finishSequentialStep,
                abortSequentialOnError,
              );
            } else {
              finishSequentialStep(key);
            }
          } else if (shouldAdvanceSequentialAfterHubFailure(node, job)) {
            advanceSequentialAfterNodeError(
              job,
              key,
              finishSequentialStep,
              abortSequentialOnError,
            );
          }
        }
        drainRef.current();
      }
    },
    [
      abortSequential,
      abortSequentialOnError,
      base,
      emitTaskPanelSync,
      finishSequentialStep,
      projectId,
      releaseInflightKey,
      setNodeRuntime,
      syncInflightTaskAfterSubmit,
      updateNodeData,
    ],
  );

  const drain = useCallback(() => {
    let i = 0;
    while (i < queueRef.current.length) {
      const item = queueRef.current[i]!;
      const key = runKey(item);
      if (inflightRef.current.has(key)) {
        i++;
        continue;
      }
      queueRef.current.splice(i, 1);
      inflightRef.current.add(key);
      // 点击即响应：乐观 pending 已在 enqueue 时同步写入；把 runOne（含上游解析 +
      // 厂商提交等同步前段）推到下一个宏任务，先让浏览器把「生成中」转圈画出来，
      // 再跑提交链路。inflightRef 已同步占位，去重不受影响。
      const job = item;
      setTimeout(() => void runOne(job), 0);
    }
  }, [runOne]);

  useEffect(() => {
    drainRef.current = drain;
  }, [drain]);

  const releaseStaleInflightLock = useCallback(
    (job: QueueItem): boolean => {
      const key = runKey(job);
      if (!inflightRef.current.has(key)) return false;
      const boundTaskId =
        taskByNodeRef.current.get(key) ??
        taskByNodeRef.current.get(job.nodeId);
      if (boundTaskId) return false;
      const node = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === job.nodeId);
      const outlineRt =
        node?.type === "story-pro2-starter" || node?.type === "story-pro-starter"
          ? (node.data as { themeOutlineRuntime?: CanvasNodeRuntime })
              .themeOutlineRuntime
          : undefined;
      if (outlineRt?.taskId?.trim()) return false;
      if (
        node &&
        isAnyStoryScriptHubType(node.type ?? "") &&
        job.llmSection
      ) {
        const sectionRt = hubSectionRuntime(node, job.llmSection);
        if (sectionRt?.taskId?.trim()) return false;
      }
      const rt = (node?.data as { runtime?: CanvasNodeRuntime } | undefined)
        ?.runtime;
      if (rt?.taskId?.trim()) return false;
      releaseInflightKey(key);
      return true;
    },
    [releaseInflightKey],
  );

  const enqueueStoryRun = useCallback(
    (job: QueueItem): boolean => {
      if (gatewayLinkBlocked) {
        const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
        const gwMsg = gatewayLinkAccountUrl
          ? `请先在 Book 个人中心关联 Gateway API Key：${gatewayLinkAccountUrl}`
          : "请先在 Book 个人中心关联 Gateway API Key";
        if (
          !applySbv1ImageRunFailure(
            node,
            updateNodeData,
            "GATEWAY_KEY_REQUIRED",
            gwMsg,
          ) &&
          node
        ) {
          setNodeRuntime(job.nodeId, {
            status: "error",
            failCode: "GATEWAY_KEY_REQUIRED",
            failMessage: gwMsg,
          });
        }
        window.dispatchEvent(
          new CustomEvent("canvas:generation-blocked", {
            detail: { nodeId: job.nodeId, message: gwMsg },
          }),
        );
        return false;
      }
      const key = runKey(job);
      if (inflightRef.current.has(key)) {
        if (job.forceFresh) {
          releaseStaleInflightLock(job);
        }
        if (inflightRef.current.has(key)) {
          if (job.forceFresh) {
            deferredForceFreshRef.current.set(key, job);
            return true;
          }
          return false;
        }
      }
      if (queueRef.current.some((q) => runKey(q) === key)) return false;
      const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
      if (
        node &&
        isAnyStoryScriptHubType(node.type ?? "") &&
        job.llmSection &&
        !job.forceFresh
      ) {
        const st = hubSectionRuntime(node, job.llmSection)?.status;
        if (isCanvasInflightStatus(st)) return false;
      }
      const rowSt = storyRowRuntimeStatus(node, job);
      if (
        !job.forceFresh &&
        (rowSt === "running" || rowSt === "pending" || rowSt === "queued")
      ) {
        return false;
      }
      detachNodeTaskRefs(job);
      markCanvasNodeGenerationStarted(job.nodeId);
      if (node) {
        const nodesNow = useCanvasStore.getState().nodes;
        if (
          !commitStoryRunPendingPatch(node, job, nodesNow, updateNodeData) &&
          !commitLibtvMediaRunPendingPatch(node, updateNodeData)
        ) {
          setNodeRuntime(job.nodeId, {
            status: "pending",
            taskId: undefined,
            failCode: undefined,
            failMessage: undefined,
          });
        }
      }
      queueRef.current.push(job);
      drain();
      pollKickRef.current?.();
      return true;
    },
    [
      drain,
      setNodeRuntime,
      updateNodeData,
      gatewayLinkAccountUrl,
      gatewayLinkBlocked,
      detachNodeTaskRefs,
      releaseStaleInflightLock,
    ],
  );

  const enqueueNode = useCallback(
    (nodeId: string, forceFresh?: boolean) => {
      return enqueueStoryRun({ nodeId, forceFresh });
    },
    [enqueueStoryRun],
  );

  const enqueueNodesSequential = useCallback(
    (nodeIds: string[], forceFresh?: boolean) => {
      if (!nodeIds.length) return;
      for (const nodeId of nodeIds) {
        setNodeRuntime(nodeId, {
          status: "queued",
          taskId: undefined,
          failCode: undefined,
          failMessage: undefined,
        });
      }
      sequentialRef.current = {
        jobs: nodeIds.map((nodeId) => ({ nodeId, forceFresh })),
        cursor: 0,
        forceFresh,
        activeKey: null,
      };
      pumpSequential();
    },
    [pumpSequential, setNodeRuntime],
  );

  const enqueueStoryRunsSequential = useCallback(
    (jobs: QueueItem[], forceFresh?: boolean) => {
      if (!jobs.length) return;

      const normalized = jobs.map((j) => ({
        ...j,
        forceFresh: j.forceFresh ?? forceFresh,
      }));

      const seenKeys = new Set<string>();
      const deduped = normalized.filter((job) => {
        const key = runKey(job);
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      const wantsForceFresh = normalized.some((j) => j.forceFresh);
      if (wantsForceFresh) {
        for (const job of deduped) {
          const key = runKey(job);
          // 新 forceFresh 顺序链：丢弃旧 deferred，避免 releaseInflightKey 回放 + pump 双提交 Gateway
          deferredForceFreshRef.current.delete(key);
          releaseStaleInflightLock(job);
        }
        if (sequentialRef.current) {
          sequentialRef.current = null;
        }
      }

      const runnable = deduped.filter((job) => {
        const key = runKey(job);
        if (inflightRef.current.has(key)) {
          if (wantsForceFresh) {
            deferredForceFreshRef.current.set(key, job);
          }
          return false;
        }
        if (queueRef.current.some((q) => runKey(q) === key)) return false;
        return true;
      });
      if (!runnable.length) return;

      const seq = sequentialRef.current;
      if (
        !wantsForceFresh &&
        seq &&
        (seq.activeKey || seq.cursor < seq.jobs.length)
      ) {
        const existing = new Set([
          ...(seq.activeKey ? [seq.activeKey] : []),
          ...seq.jobs.slice(seq.cursor).map(runKey),
        ]);
        const toAppend = runnable.filter((j) => !existing.has(runKey(j)));
        if (toAppend.length) {
          seq.jobs.push(...toAppend);
          pumpSequential();
        }
        return;
      }

      sequentialRef.current = {
        jobs: runnable,
        cursor: 0,
        forceFresh,
        activeKey: null,
      };
      for (const job of runnable) {
        markCanvasNodeGenerationStarted(job.nodeId);
      }
      for (const job of runnable) {
        setNodeRuntime(job.nodeId, {
          status: "queued",
          taskId: undefined,
          failCode: undefined,
          failMessage: undefined,
        });
      }
      pumpSequential();
    },
    [pumpSequential, releaseStaleInflightLock, setNodeRuntime],
  );

  const enqueueStoryRunRef = useRef(enqueueStoryRun);
  const enqueueNodesSequentialRef = useRef(enqueueNodesSequential);
  const enqueueStoryRunsSequentialRef = useRef(enqueueStoryRunsSequential);
  useEffect(() => {
    enqueueStoryRunRef.current = enqueueStoryRun;
  }, [enqueueStoryRun]);
  useEffect(() => {
    enqueueNodesSequentialRef.current = enqueueNodesSequential;
  }, [enqueueNodesSequential]);
  useEffect(() => {
    enqueueStoryRunsSequentialRef.current = enqueueStoryRunsSequential;
  }, [enqueueStoryRunsSequential]);

  const resolveCancelTaskId = useCallback(
    (job: CanvasCancelGenerationJob, node?: CanvasFlowNode): string | undefined => {
      const explicit = job.taskId?.trim();
      if (explicit) return explicit;
      const key = runKey(job);
      const fromRef =
        taskByNodeRef.current.get(key) ??
        taskByNodeRef.current.get(job.nodeId);
      if (fromRef?.trim()) return fromRef.trim();
      if (!node) return undefined;
      if (job.llmSection && isAnyStoryScriptHubType(node.type ?? "")) {
        return hubSectionRuntime(node, job.llmSection)?.taskId?.trim() || undefined;
      }
      if (job.rowKey) {
        const rows = (
          node.data as {
            rows?: {
              key: string;
              runtime?: CanvasNodeRuntime;
              videoRuntime?: CanvasNodeRuntime;
              ttsRuntime?: CanvasNodeRuntime;
            }[];
          }
        ).rows;
        const row = rows?.find((r) => r.key === job.rowKey);
        if (job.mediaKind === "tts") return row?.ttsRuntime?.taskId?.trim();
        if (job.mediaKind === "video") return row?.videoRuntime?.taskId?.trim();
        return row?.runtime?.taskId?.trim();
      }
      if (node.type === "story-pro2-starter" || node.type === "story-pro-starter") {
        return (
          node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
        ).themeOutlineRuntime?.taskId?.trim();
      }
      return (node.data as { runtime?: CanvasNodeRuntime }).runtime?.taskId?.trim();
    },
    [],
  );

  const cancelCanvasGeneration = useCallback(
    (job: CanvasCancelGenerationJob): boolean => {
      if (!projectId) return false;
      const nodesNow = useCanvasStore.getState().nodes;
      const node = nodesNow.find((n) => n.id === job.nodeId);
      const queueJob = job as QueueItem;
      const key = runKey(queueJob);

      queueRef.current = queueRef.current.filter((q) => runKey(q) !== key);
      releaseInflightKey(key);
      releaseInflightKey(job.nodeId);

      const taskId = resolveCancelTaskId(job, node);
      if (node) {
        if (
          !commitStoryRunCancelLocal(
            node,
            queueJob,
            nodesNow,
            updateNodeData,
            taskId,
          )
        ) {
          setNodeRuntime(job.nodeId, canvasIdleRuntimeAfterUserCancel(taskId));
          if (
            isLibtvFreestandingImageNode(node) ||
            node.type === "story-pro2-three-view" ||
            node.type === "story-pro2-audio"
          ) {
            updateNodeData(job.nodeId, {
              uploading: false,
              uploadError: undefined,
            });
          }
        }
      }

      detachNodeTaskRefs(queueJob);
      clearCanvasNodeRunSession(job.nodeId);
      abortSequentialOnError(key);

      if (taskId) {
        void cancelCanvasGenerationTask(base, projectId, taskId)
          .then(() => {
            emitTaskPanelSync({ id: taskId, status: "CANCELLED" });
          })
          .catch(() => {
            /* 本地已清态；服务端取消失败不阻塞 UI */
          });
      }

      pollKickRef.current?.();
      return true;
    },
    [
      abortSequentialOnError,
      base,
      detachNodeTaskRefs,
      emitTaskPanelSync,
      projectId,
      releaseInflightKey,
      resolveCancelTaskId,
      setNodeRuntime,
      updateNodeData,
    ],
  );

  const cancelCanvasGenerationRef = useRef(cancelCanvasGeneration);
  useEffect(() => {
    cancelCanvasGenerationRef.current = cancelCanvasGeneration;
  }, [cancelCanvasGeneration]);

  useEffect(() => {
    registerCanvasRunBus({
      enqueueNode: (nodeId, forceFresh) =>
        enqueueStoryRunRef.current({ nodeId, forceFresh }),
      enqueueStoryRun: (job) => enqueueStoryRunRef.current(job),
      enqueueNodesSequential: (nodeIds, opts) =>
        enqueueNodesSequentialRef.current(nodeIds, opts?.forceFresh),
      enqueueStoryRunsSequential: (jobs, opts) =>
        enqueueStoryRunsSequentialRef.current(jobs, opts?.forceFresh),
      cancelGeneration: (job) => cancelCanvasGenerationRef.current(job),
    });
    return () => unregisterCanvasRunBus();
  }, []);

  /** 监听节点自己抛的 "canvas:run-node" 事件（兼容旧路径） */
  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<CanvasStoryRunJob>;
      if (!e.detail?.nodeId) return;
      enqueueStoryRun(e.detail);
    };
    window.addEventListener("canvas:run-node", handler);
    return () => window.removeEventListener("canvas:run-node", handler);
  }, [enqueueStoryRun]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<CanvasCancelGenerationJob>;
      if (!e.detail?.nodeId) return;
      cancelCanvasGeneration(e.detail);
    };
    window.addEventListener("canvas:cancel-generation", handler);
    return () => window.removeEventListener("canvas:cancel-generation", handler);
  }, [cancelCanvasGeneration]);

  useEffect(() => {
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{
        nodeIds?: string[];
        jobs?: QueueItem[];
        forceFresh?: boolean;
      }>;
      if (e.detail?.jobs?.length) {
        enqueueStoryRunsSequential(e.detail.jobs, e.detail.forceFresh);
        return;
      }
      if (!e.detail?.nodeIds?.length) return;
      enqueueNodesSequential(e.detail.nodeIds, e.detail.forceFresh);
    };
    window.addEventListener("canvas:run-nodes-sequential", handler);
    window.addEventListener("canvas:run-jobs-sequential", handler);
    return () => {
      window.removeEventListener("canvas:run-nodes-sequential", handler);
      window.removeEventListener("canvas:run-jobs-sequential", handler);
    };
  }, [enqueueNodesSequential, enqueueStoryRunsSequential]);

  /** 异步任务完成时推进顺序链 */
  useEffect(() => {
    return useCanvasStore.subscribe((state) => {
      const seq = sequentialRef.current;
      if (!seq?.activeKey) return;
      const job = seq.jobs[seq.cursor];
      if (!job) return;
      const node = state.nodes.find((n) => n.id === job.nodeId);
      if (!node) return;
      let done = false;
      if (isAnyStoryScriptHubType(node.type ?? "") && job.llmSection) {
        done =
          hubSectionIsComplete(node, job.llmSection) ||
          hubSectionHasTerminalError(node, job.llmSection);
      } else if (job.rowKey) {
        done = storyRowRuntimeStatus(node, job) === "done" ||
          storyRowRuntimeStatus(node, job) === "error";
      } else if (isStoryLlmNodeType(node.type ?? "")) {
        done =
          nodeRuntimeStatus(node) === "done" && storyLlmNodeIsComplete(node);
      } else {
        done =
          nodeRuntimeStatus(node) === "done" ||
          nodeRuntimeStatus(node) === "error";
      }
      if (!done) return;
      const key = canvasStoryRunJobKey(job);
      const rowErr =
        job.rowKey && storyRowRuntimeStatus(node, job) === "error";
      if (rowErr && job.mediaKind === "sceneRef") {
        finishSequentialStep(key);
        return;
      }
      if (rowErr || nodeRuntimeStatus(node) === "error") {
        advanceSequentialAfterNodeError(
          job,
          key,
          finishSequentialStep,
          abortSequentialOnError,
        );
        return;
      }
      if (shouldAdvanceSequentialAfterHubFailure(node, job)) {
        advanceSequentialAfterNodeError(
          job,
          key,
          finishSequentialStep,
          abortSequentialOnError,
        );
        return;
      }
      finishSequentialStep(key);
    });
  }, [abortSequentialOnError, finishSequentialStep]);

  /** 5 秒轮询：同步服务端任务状态；刷新后也能恢复进行中的异步任务 */
  useEffect(() => {
    if (!base || !projectId) return;
    let cancelled = false;
    let pollStopped = false;
    let loopTimer = 0;
    let tickCount = 0;
    /** 防止 pollKick 叠出并行 loop（否则 tasks 会打满浏览器连接，PATCH 排队超时） */
    let pollLoopRunning = false;
    let pollKickPending = false;
    let pollKickPendingFullScan = false;
    /** 上一次轮询是否读道降级（tasks==null）；用于自适应退避到 15s */
    let lastPollStale = false;
    const serverInflightRef = { current: false };
    let firstPollTick = true;
    const applyStoryColumnRowTasks = (
      tasks: CanvasTaskRecord[],
      nodes: CanvasFlowNode[],
    ) => {
      const applyRowPick = (
        node: CanvasFlowNode,
        pick: CanvasTaskRecord,
        job: CanvasStoryRunJob,
        localRuntime: CanvasNodeRuntime | undefined,
      ) => {
        if (shouldSkipStoryRowTaskApply(localRuntime, pick, node.id)) return;
        storyApplyTaskResult(node, pick, job, updateNodeData, nodes);
        if (pick.status === "SUCCEEDED" || pick.status === "FAILED") {
          releaseInflightKey(runKey(job));
        }
      };

      for (const node of nodes) {
        const nodeTasks = tasks.filter((t) => t.nodeId === node.id);
        if (!nodeTasks.length) continue;

        if (isAnyStoryScriptHubType(node.type ?? "")) {
          for (const section of ["outline", "character", "scene", "storyboard"] as const) {
            const scope = { llmSection: section };
            const localRt = hubSectionRuntime(node, section);
            const pick = pickPreferredCanvasTaskForScope(
              nodeTasks,
              scope,
              localRt,
              node.id,
            );
            if (!pick) continue;
            const job: CanvasStoryRunJob =
              jobByTaskRef.current.get(pick.id) ??
              storyRunContextFromScope(node.id, scope);
            applyRowPick(node, pick, job, localRt);
          }
          continue;
        }

        if (isAnyStorySceneColumnType(node.type ?? "")) {
          const rows =
            (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] }).rows ?? [];
          for (const row of rows) {
            const scope = { rowKey: row.key, mediaKind: "sceneRef" as const };
            const pick = pickStoryRowApplyTask(
              nodeTasks,
              scope,
              row.runtime,
            );
            if (!pick) continue;
            const job: CanvasStoryRunJob =
              jobByTaskRef.current.get(pick.id) ??
              storyRunContextFromScope(node.id, scope);
            applyRowPick(
              node,
              pick,
              job,
              (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
                .rows?.find((r) => r.key === row.key)?.runtime,
            );
          }
          continue;
        }

        if (isAnyStoryCharacterColumnType(node.type ?? "")) {
          const rows =
            (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
              .rows ?? [];
          for (const row of rows) {
            const scope = { rowKey: row.key, mediaKind: "threeView" };
            const pick = pickStoryRowApplyTask(
              nodeTasks,
              scope,
              row.runtime,
            );
            if (!pick) continue;
            const job: CanvasStoryRunJob =
              jobByTaskRef.current.get(pick.id) ??
              storyRunContextFromScope(node.id, scope);
            applyRowPick(node, pick, job, row.runtime);
          }
          continue;
        }

        if (isAnyStoryFrameColumnType(node.type ?? "")) {
          const rows =
            (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
              .rows ?? [];
          for (const row of rows) {
            const scope = { rowKey: row.key, mediaKind: "frameImage" };
            const pick = pickStoryRowApplyTask(
              nodeTasks,
              scope,
              row.runtime,
            );
            if (!pick) continue;
            const job: CanvasStoryRunJob =
              jobByTaskRef.current.get(pick.id) ??
              storyRunContextFromScope(node.id, scope);
            applyRowPick(node, pick, job, row.runtime);
          }
          continue;
        }

        if (isAnyStoryVideoColumnType(node.type ?? "")) {
          const rows =
            (node.data as {
              rows?: {
                key: string;
                videoRuntime?: CanvasNodeRuntime;
                ttsRuntime?: CanvasNodeRuntime;
              }[];
            }).rows ?? [];
          for (const row of rows) {
            for (const mediaKind of ["video", "tts"] as const) {
              const scope = { rowKey: row.key, mediaKind };
              const pick = pickStoryRowApplyTask(
                nodeTasks,
                scope,
                mediaKind === "tts" ? row.ttsRuntime : row.videoRuntime,
              );
              if (!pick) continue;
              const job: CanvasStoryRunJob =
                jobByTaskRef.current.get(pick.id) ??
                storyRunContextFromScope(node.id, scope);
              applyRowPick(
                node,
                pick,
                job,
                mediaKind === "tts" ? row.ttsRuntime : row.videoRuntime,
              );
            }
          }
        }
      }
    };

    const storyColumnNodeIds = () =>
      new Set(
        useCanvasStore
          .getState()
          .nodes.filter(
            (n) =>
              n.type === "story-character-column" ||
              n.type === "story-pro-character" ||
              n.type === "story-pro2-character" ||
              n.type === "story-pro-scene" ||
              n.type === "story-pro2-scene" ||
              n.type === "story-frame-column" ||
              n.type === "story-pro-frame" ||
              n.type === "story-pro2-frame" ||
              n.type === "story-video-column" ||
              n.type === "story-pro-video" ||
              n.type === "story-pro2-video",
          )
          .map((n) => n.id),
      );

    const applyTaskUpdate = (
      t: CanvasTaskRecord,
      nodeId: string,
      nodes: CanvasFlowNode[],
    ) => {
      const node = nodes.find((n) => n.id === nodeId);
      const job = jobByTaskRef.current.get(t.id);
      if (node && isStoryWorkspaceNodeType(node.type ?? "")) {
        const scope = t.storyScope ?? {};
        const ctx: CanvasStoryRunJob = {
          ...(job ?? {}),
          ...storyRunContextFromScope(nodeId, scope),
          nodeId,
        };
        if (
          ctx.llmSection &&
          shouldSkipHubSectionInflightTaskApply(node, ctx.llmSection, t)
        ) {
          return;
        }
        storyApplyTaskResult(node, t, ctx, updateNodeData, nodes);
        if (
          t.status === "SUCCEEDED" ||
          t.status === "FAILED" ||
          t.status === "CANCELLED"
        ) {
          releaseInflightKey(runKey(ctx));
          releaseInflightKey(nodeId);
          if (t.status === "SUCCEEDED") maybeNotifyCanvasCreditsSettled(t);
          emitTaskPanelSync(t, { flushAutosave: t.status === "SUCCEEDED" });
        }
        return;
      }

      const localRt = node
        ? (node.data as { runtime?: CanvasNodeRuntime }).runtime
        : undefined;
      const localSt = node ? nodeRuntimeStatus(node) : undefined;
      let boundTaskId: string | undefined;
      for (const [k, tid] of Array.from(taskByNodeRef.current.entries())) {
        if (k.startsWith(`${nodeId}:`) || k === nodeId) {
          if (tid === t.id) boundTaskId = tid;
        }
      }
      boundTaskId ??= taskByNodeRef.current.get(nodeId);
      const localTaskId = localRt?.taskId?.trim();
      const isTerminal =
        t.status === "SUCCEEDED" ||
        t.status === "FAILED" ||
        t.status === "CANCELLED";
      const isCurrentTaskTerminal =
        jobByTaskRef.current.has(t.id) ||
        (localTaskId != null && localTaskId === t.id) ||
        boundTaskId === t.id;
      // 本地 pending/running 时，列表「最新」可能仍是上一轮终态任务
      if (isLocalInflightStatus(localSt) && isTerminal) {
        if (shouldSkipStoryRowTaskApply(localRt, t, nodeId)) return;
        if (!isCurrentTaskTerminal) return;
      }
      // 仍绑定其它 taskId 时，忽略「非当前任务」的终态，避免旧成功覆盖新提交
      if (
        isLocalInflightStatus(localSt) &&
        boundTaskId &&
        t.id !== boundTaskId &&
        isTerminal
      ) {
        return;
      }

      const patch = runtimePatchFromCanvasTask(t);
      if (node && isLibtvFreestandingImageNode(node)) {
        const sbv1Patch = sbv1ImagePatchFromTask(
          node.data as unknown as Sbv1ImageNodeData,
          t,
        );
        if (sbv1Patch) {
          const rtPatch = sbv1Patch.runtime as Partial<CanvasNodeRuntime> | undefined;
          if (shouldSkipStoryRowTaskApply(localRt, t, nodeId)) return;
          if (
            rtPatch &&
            !shouldApplyCanvasTaskRuntimePatch(localRt, t, rtPatch, nodeId)
          ) {
            return;
          }
          if (
            !isSameSbv1MediaDataPatch(
              node.data as Record<string, unknown>,
              sbv1Patch,
            )
          ) {
            updateNodeData(nodeId, sbv1Patch);
          }
          const st = (sbv1Patch.runtime as CanvasNodeRuntime | undefined)?.status;
          if (st === "done" || st === "error" || st === "idle") {
            maybeClearHubPendingSceneSyncGroup(
              useCanvasStore.getState().nodes.map((n) =>
                n.id === nodeId
                  ? { ...n, data: { ...n.data, ...sbv1Patch } }
                  : n,
              ),
              nodeId,
              updateNodeData,
            );
            const job = jobByTaskRef.current.get(t.id);
            if (job) {
              releaseInflightKey(runKey(job));
              taskByNodeRef.current.delete(runKey(job));
            }
            taskByNodeRef.current.delete(nodeId);
            if (st === "done") maybeNotifyCanvasCreditsSettled(t);
            emitTaskPanelSync(t, { flushAutosave: st === "done" });
          }
        } else if (
          patch &&
          (t.status === "SUCCEEDED" || t.status === "FAILED" || t.status === "CANCELLED")
        ) {
          const mediaUrl = pickTaskResultMediaUrl(t) ?? t.ossUrl ?? undefined;
          const fallbackPatch: Record<string, unknown> = {
            uploading: false,
            uploadError: undefined,
            runtime: patch,
            ...(mediaUrl && t.status === "SUCCEEDED"
              ? { ossUrl: mediaUrl, blobUrl: undefined }
              : {}),
          };
          if (
            !isSameSbv1MediaDataPatch(
              node.data as Record<string, unknown>,
              fallbackPatch,
            )
          ) {
            updateNodeData(nodeId, fallbackPatch);
          }
          if (patch.status === "done" || patch.status === "error" || patch.status === "idle") {
            const job = jobByTaskRef.current.get(t.id);
            if (job) {
              releaseInflightKey(runKey(job));
              taskByNodeRef.current.delete(runKey(job));
            }
            taskByNodeRef.current.delete(nodeId);
            if (patch.status === "done") maybeNotifyCanvasCreditsSettled(t);
            emitTaskPanelSync(t, { flushAutosave: patch.status === "done" });
          }
        }
        return;
      }
      if (node?.type === "sbv1-video-engine") {
        const videoPatch = sbv1VideoPatchFromTask(t);
        if (videoPatch) {
          const rtPatch = videoPatch.runtime as Partial<CanvasNodeRuntime> | undefined;
          if (shouldSkipStoryRowTaskApply(localRt, t, nodeId)) return;
          if (
            rtPatch &&
            !shouldApplyCanvasTaskRuntimePatch(localRt, t, rtPatch, nodeId)
          ) {
            return;
          }
          if (
            !isSameSbv1MediaDataPatch(
              node.data as Record<string, unknown>,
              videoPatch,
            )
          ) {
            updateNodeData(nodeId, videoPatch);
          }
          const st = (videoPatch.runtime as CanvasNodeRuntime | undefined)?.status;
          if (st === "done" || st === "error") {
            const job = jobByTaskRef.current.get(t.id);
            if (job) releaseInflightKey(runKey(job));
            if (st === "done") maybeNotifyCanvasCreditsSettled(t);
            emitTaskPanelSync(t, { flushAutosave: st === "done" });
          }
        }
        return;
      }
      if (patch) {
        if (!shouldApplyCanvasTaskRuntimePatch(localRt, t, patch, nodeId)) return;
        setNodeRuntime(nodeId, patch);
        if (t.textOutput) {
          if (node?.type === "ai-engine" || isStoryLlmNodeType(node?.type ?? "")) {
            propagateTextOutputToDownstream(
              nodeId,
              t.textOutput,
              setNodeRuntime,
            );
          }
        }
        if (patch.status === "done" || patch.status === "error" || patch.status === "idle") {
          const job = jobByTaskRef.current.get(t.id);
          if (job) {
            releaseInflightKey(runKey(job));
          } else {
            releaseInflightKey(nodeId);
            for (const key of Array.from(inflightRef.current)) {
              if (key.startsWith(`${nodeId}:`)) releaseInflightKey(key);
            }
          }
          if (patch.status === "done") maybeNotifyCanvasCreditsSettled(t);
          emitTaskPanelSync(t, { flushAutosave: patch.status === "done" });
        }
      }
    };

    const tick = async (forceFullScan = false) => {
      if (cancelled || pollStopped) return;
      // 保存占连接时跳过本轮 DB 拉取，给 PATCH 让路
      if (isCanvasSaveInFlight()) return;
      tickCount++;
      const periodicFullScan =
        !forceFullScan && tickCount % FULL_SCAN_EVERY_N_TICKS === 0;
      const fullScan =
        forceFullScan || periodicFullScan || firstPollTick;
      if (firstPollTick) firstPollTick = false;

      const state = useCanvasStore.getState();
      const localInflightIds = collectCanvasTaskPollNodeIds(state.nodes);
      const shouldPoll =
        fullScan ||
        localInflightIds.length > 0 ||
        serverInflightRef.current ||
        inflightRef.current.size > 0 ||
        queueRef.current.length > 0;
      if (!shouldPoll) return;

      const nodeIds =
        fullScan || serverInflightRef.current
          ? undefined
          : localInflightIds;

      try {
        const tasks = await listCanvasProjectTasks(base, projectId, nodeIds);
        if (cancelled) return;
        // 读道降级（DB 塞车 / 不可用）：保留上一帧，不覆盖快照、不误清进行中状态；
        // 同时标记 stale，让自适应轮询退避到 15s，给 DB 喘息。
        if (tasks == null) {
          lastPollStale = true;
          return;
        }
        lastPollStale = false;
        ingestCanvasProjectTasks(projectId, tasks);
        const nodesNow = useCanvasStore.getState().nodes;
        restoreServerInflightNodeRuntimes(
          nodesNow,
          tasks,
          updateNodeData,
          setNodeRuntime,
        );
        applyStoryColumnRowTasks(tasks, nodesNow);
        syncPro2CharacterGroupImagesFromColumnRuntimes(
          useCanvasStore.getState().nodes,
          updateNodeData,
        );
        const skipReconcileNodeIds = new Set<string>();
        for (const key of inflightRef.current) {
          skipReconcileNodeIds.add(key.split(":")[0]!);
        }
        for (const key of deferredForceFreshRef.current.keys()) {
          skipReconcileNodeIds.add(key.split(":")[0]!);
        }
        for (const job of queueRef.current) {
          skipReconcileNodeIds.add(job.nodeId);
        }
        for (const key of taskByNodeRef.current.keys()) {
          skipReconcileNodeIds.add(key.split(":")[0]!);
        }
        reconcileStaleInflightRuntimes(
          useCanvasStore.getState().nodes,
          tasks,
          updateNodeData,
          setNodeRuntime,
          { skipNodeIds: skipReconcileNodeIds },
        );
        const columnIds = storyColumnNodeIds();
        const latestByNode = latestTasksByNode(tasks, useCanvasStore.getState().nodes);
        let serverInflight = 0;
        latestByNode.forEach((t, nodeId) => {
          if (isServerInflightStatus(t.status)) serverInflight++;
          if (!columnIds.has(nodeId)) {
            applyTaskUpdate(t, nodeId, useCanvasStore.getState().nodes);
          }
        });
        for (const t of tasks) {
          if (isServerInflightStatus(t.status)) serverInflight++;
        }
        if (fullScan) {
          backfillFrameVideoRuntimesFromTasks(
            useCanvasStore.getState().nodes,
            tasks,
            setNodeRuntime,
          );
        }
        serverInflightRef.current = serverInflight > 0;
      } catch (e) {
        if (isCanvasApiAccessDeniedError(e)) {
          pollStopped = true;
          serverInflightRef.current = false;
          markCanvasProjectTasksForbidden(projectId);
          markCanvasProjectTasksPoolForbidden(projectId);
          if (loopTimer) window.clearTimeout(loopTimer);
        }
      }
    };

    /** 当前在飞工作量：本地在飞 + 服务端在飞 + 队列 + 正在跑的 runOne */
    const currentInflightCount = (): number => {
      const localInflight = collectCanvasTaskPollNodeIds(
        useCanvasStore.getState().nodes,
      ).length;
      return (
        localInflight +
        (serverInflightRef.current ? 1 : 0) +
        inflightRef.current.size +
        queueRef.current.length
      );
    };

    // Gen-HotCold-R2 Phase 4：自适应轮询。固定 2s 空轮询替换为按在飞数退避；
    // 无在飞时暂停 DB 轮询，只保留廉价的「空转再探」节拍唤醒。
    const scheduleNext = () => {
      if (cancelled || pollStopped) return;
      if (pollKickPending) {
        const full = pollKickPendingFullScan;
        pollKickPending = false;
        pollKickPendingFullScan = false;
        loopTimer = window.setTimeout(() => void loop(full), 0);
        return;
      }
      const mediaRenderActive = hasAnyMediaRenderInFlight(
        useCanvasStore.getState().nodes,
      );
      // 保存进行中：拉长轮询，避免与 PATCH 抢 DB / 浏览器连接
      if (isCanvasSaveInFlight()) {
        const delay = CANVAS_POLL_MEDIA_RENDER_BACKOFF_MS;
        loopTimer = window.setTimeout(() => void loop(), delay);
        return;
      }
      const ms = nextPollIntervalMs(
        currentInflightCount(),
        lastPollStale,
        mediaRenderActive,
      );
      const delay = ms > 0 ? ms : CANVAS_POLL_IDLE_RECHECK_MS;
      loopTimer = window.setTimeout(() => void loop(), delay);
    };

    const loop = async (forceFullScan = false) => {
      if (cancelled || pollStopped) return;
      if (pollLoopRunning) {
        pollKickPending = true;
        if (forceFullScan) pollKickPendingFullScan = true;
        return;
      }
      pollLoopRunning = true;
      try {
        await tick(forceFullScan);
      } finally {
        pollLoopRunning = false;
      }
      if (cancelled || pollStopped) return;
      scheduleNext();
    };

    let mediaRenderPollKickEarliest = 0;
    pollKickRef.current = () => {
      if (cancelled || pollStopped) return;
      // 保存中：只记 pending，不立刻开新 GET
      if (isCanvasSaveInFlight()) {
        pollKickPending = true;
        return;
      }
      if (pollLoopRunning) {
        pollKickPending = true;
        return;
      }
      if (hasAnyMediaRenderInFlight(useCanvasStore.getState().nodes)) {
        const now = Date.now();
        if (now < mediaRenderPollKickEarliest) return;
        mediaRenderPollKickEarliest =
          now + CANVAS_POLL_MEDIA_RENDER_BACKOFF_MS;
        if (loopTimer) window.clearTimeout(loopTimer);
        loopTimer = window.setTimeout(
          () => void loop(false),
          CANVAS_POLL_MEDIA_RENDER_BACKOFF_MS,
        );
        return;
      }
      if (loopTimer) window.clearTimeout(loopTimer);
      void loop(false);
    };

    const unsubTasksChanged = subscribeCanvasTasksChanged(projectId, () => {
      pollKickRef.current?.();
    });

    const initialDelay =
      inflightRef.current.size > 0 ||
      queueRef.current.length > 0 ||
      collectCanvasTaskPollNodeIds(useCanvasStore.getState().nodes).length > 0
        ? 0
        : INITIAL_TICK_DELAY_MS;
    const initialTickTimer = window.setTimeout(
      () => void loop(false),
      initialDelay,
    );
    const fullScanDelay =
      inflightRef.current.size > 0 || queueRef.current.length > 0
        ? Math.min(INITIAL_FULL_SCAN_DELAY_MS, 1500)
        : INITIAL_FULL_SCAN_DELAY_MS;
    const fullScanTimer = window.setTimeout(
      () => void tick(true),
      fullScanDelay,
    );
    return () => {
      cancelled = true;
      unsubTasksChanged();
      pollKickRef.current = null;
      if (loopTimer) window.clearTimeout(loopTimer);
      window.clearTimeout(initialTickTimer);
      window.clearTimeout(fullScanTimer);
    };
  }, [base, projectId, releaseInflightKey, setNodeRuntime, updateNodeData, emitTaskPanelSync]);

  return { enqueueNode };
}

/** 独立挂载，避免与页面其它 hooks 热更新时顺序错乱。 */
export function CanvasRunnerHost({
  projectId,
  gatewayLinkBlocked,
  gatewayLinkAccountUrl,
}: {
  projectId: string;
  gatewayLinkBlocked?: boolean;
  gatewayLinkAccountUrl?: string | null;
}) {
  useCanvasRunner(projectId, { gatewayLinkBlocked, gatewayLinkAccountUrl });
  return null;
}
