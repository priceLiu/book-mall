"use client";

import { useCallback, useEffect, useRef } from "react";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import {
  isCanvasApiAccessDeniedError,
  listCanvasProjectTasks,
  markCanvasProjectTasksForbidden,
  runCanvasNode,
  type CanvasTaskRecord,
} from "@/lib/canvas-api";
import { useCanvasStore } from "./store";
import { buildCanvasRunSnapshot } from "./canvas-run-snapshot";
import { resolveSbv1VideoEngineInputs } from "./resolve-sbv1-video-engine-inputs";
import {
  resolvePortraitAssetRefsFromUpstream,
} from "./resolve-portrait-asset-refs";
import { directPredecessors } from "./topo";
import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import { dockMentionRefUrlsForPrompt } from "./dock-mention-ref-urls";
import { resolvePro2DockUpstreamLinks } from "./pro2-dock-upstream-links";
import { findStyleAssetLinkedToImage } from "./pro2-style-asset-connect";
import { pro2DockMentionRefCatalog } from "./pro2-dock-ref-catalog";
import { resolveSbv1UpstreamRefLinks } from "./sbv1-upstream-ref-links";
import type { StoryRefImage } from "./story-ref-image";
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
import { formatCanvasTaskError } from "./friendly-task-error";
import { maybeNotifyCanvasCreditsSettled } from "./canvas-credits-notify";
import {
  registerCanvasRunBus,
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
  commitStoryRunPendingPatch,
  storyApplyTaskResult,
} from "./story-run-apply";
import {
  sbv1ImageFailurePatch,
  sbv1ImagePatchFromTask,
} from "./sbv1-image-task-apply";
import {
  commitLibtvMediaRunPendingPatch,
  isLibtvFreestandingImageNode,
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
  hubSectionNeedsRun,
  hubSectionRuntime,
} from "./story-hub-runtime";
import { isCanvasInflightStatus } from "./story-column-runtime";
import {
  storyLlmNodeIsComplete,
  storyLlmNodeNeedsRun,
} from "./story-llm-runtime";
import {
  pickRuntimeImagePreviewUrl,
  pickTaskImagePreviewUrl,
  pickTaskModelDownloadUrl,
  pickTaskResultMediaUrl,
} from "./task-media-url";
import {
  backfillFrameVideoRuntimesFromTasks,
  pickPreferredCanvasTask,
  pickPreferredCanvasTaskForScope,
  preferredTasksByNode,
  runtimePatchFromCanvasTask,
  shouldApplyCanvasTaskRuntimePatch,
  shouldSkipStoryRowTaskApply,
  storyRunContextFromScope,
} from "./task-pick";

const POLL_INTERVAL_MS = 2000;
/** 打开画布后延迟全量任务扫描，避免首屏与大量媒体加载抢主线程 */
const INITIAL_FULL_SCAN_DELAY_MS = 2500;
/** 每 N 次 tick 做一次全项目任务扫描，避免刷新后 runtime 丢失导致轮询停住 */
const FULL_SCAN_EVERY_N_TICKS = 3;

function nodeRuntimeStatus(node: CanvasFlowNode): string | undefined {
  return (node.data as { runtime?: { status?: string } }).runtime?.status;
}

function isLocalInflightStatus(status?: string): boolean {
  return status === "pending" || status === "running";
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
    (node.type === "story-pro2-starter" || node.type === "story-pro-starter") &&
    job.mediaKind === "themeOutline"
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
): Map<string, CanvasTaskRecord> {
  return preferredTasksByNode(tasks);
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
  const out: string[] = [];
  for (const pid of directPredecessors(edges, nodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (!p) continue;
    if (p.type === "image") {
      const d = p.data as unknown as ImageNodeData;
      if (d.ossUrl) out.push(d.ossUrl);
    } else if (p.type === "sbv1-image") {
      const d = p.data as { ossUrl?: string; blobUrl?: string };
      if (d.ossUrl) out.push(d.ossUrl);
    } else if (p.type === "story-pro2-style-asset") {
      const d = p.data as { imageUrl?: string };
      if (d.imageUrl?.trim()) out.push(d.imageUrl.trim());
    } else if (isRefGridNodeType(p.type ?? "")) {
      out.push(...collectRefImageUrlsFromGridNode(p));
    } else if (p.type === "image-engine" || p.type === "three-view-engine" || p.type === "video-engine") {
      const d = p.data as unknown as ImageEngineNodeData;
      const url =
        pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ?? d.runtime?.ossUrl;
      if (url) out.push(url);
    } else if (p.type === "tts-engine") {
      const d = p.data as unknown as { runtime?: { ossUrl?: string } };
      if (d.runtime?.ossUrl) out.push(d.runtime.ossUrl);
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
  if (rowKey && isStoryWorkspaceNodeType(node.type ?? "")) {
    const rows = (d.rows as { key?: string; prompt?: string }[] | undefined) ?? [];
    const row = rows.find((r) => r.key === rowKey);
    if (row?.prompt) return String(row.prompt);
    const imageNode = nodes.find(
      (n) =>
        (n.type === "story-pro2-image" || n.type === "story-pro2-three-view") &&
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
    return pro2DockMentionRefCatalog(links, []);
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
    const imageNode = nodes.find(
      (n) =>
        (n.type === "story-pro2-image" || n.type === "story-pro2-three-view") &&
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

  const prompt =
    opts?.prompt ??
    promptForDockMentionFilter(node, nodes, edges, opts?.rowKey);
  const catalog = mentionCatalogForNode(node, nodes, edges, opts?.rowKey);

  if (prompt.trim() && catalog.length > 0) {
    const mentioned = parseReferencedIds(prompt);
    if (mentioned.length > 0) {
      return dockMentionRefUrlsForPrompt(prompt, catalog);
    }
  }

  return resolveImageInputsRaw(nodes, edges, nodeId);
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
  updateNodeData(node.id, patch);
  return true;
}

function applySbv1ImageRunFailure(
  node: CanvasFlowNode | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  failCode: string,
  failMessage: string,
): boolean {
  if (!node || !isLibtvFreestandingImageNode(node)) return false;
  updateNodeData(node.id, sbv1ImageFailurePatch(failCode, failMessage));
  return true;
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
  const sequentialRef = useRef<{
    jobs: QueueItem[];
    cursor: number;
    forceFresh?: boolean;
    activeKey: string | null;
  } | null>(null);

  const runKey = (job: QueueItem) => {
    const parts = [job.nodeId];
    if (job.llmSection) parts.push(job.llmSection);
    if (job.rowKey) parts.push(job.rowKey);
    if (job.mediaKind) parts.push(job.mediaKind);
    return parts.join(":");
  };

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

  const releaseInflightKey = useCallback((key: string) => {
    if (!inflightRef.current.delete(key)) return;
    const deferred = deferredForceFreshRef.current.get(key);
    if (!deferred) return;
    deferredForceFreshRef.current.delete(key);
    queueRef.current.push(deferred);
    drainRef.current();
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
            setNodeRuntime(job.nodeId, {
              status: "error",
              failCode: "RUN_ABORTED",
              failMessage: formatCanvasTaskError("RUN_ABORTED", message),
            });
          }
        }
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
    const nodesNow = useCanvasStore.getState().nodes;
    if (
      !commitStoryRunPendingPatch(node, job, nodesNow, updateNodeData) &&
      !commitLibtvMediaRunPendingPatch(node, updateNodeData)
    ) {
      setNodeRuntime(job.nodeId, {
        status: "pending",
        failCode: undefined,
        failMessage: undefined,
      });
    }
    queueRef.current.push({ ...job, forceFresh: seq.forceFresh });
    drainRef.current();
  }, [abortSequential, setNodeRuntime, updateNodeData, detachNodeTaskRefs]);

  useEffect(() => {
    pumpSequentialRef.current = pumpSequential;
  }, [pumpSequential]);

  const runOne = useCallback(
    async (job: QueueItem) => {
      const key = runKey(job);
      const { nodeId, forceFresh } = job;
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
        if (node.type === "sbv1-video-engine") {
          const vd = node.data as { prompt?: string; referenceMode?: string };
          const resolved = resolveSbv1VideoEngineInputs(
            state.nodes,
            state.edges,
            nodeId,
            {
              prompt: String(vd.prompt ?? ""),
              referenceMode:
                vd.referenceMode === "first_last" ||
                vd.referenceMode === "smart_multi"
                  ? vd.referenceMode
                  : "omni",
            },
          );
          if (!resolved.ok) {
            abortSequential(job, resolved.error);
            return;
          }
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

        const data = node.data as Record<string, unknown>;
        const runData = isLibtvFreestandingImageNode(node)
          ? resolveSbv1ImageRunData(node, state.nodes, state.edges, data)
          : data;
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

        const r = await runCanvasNode(base, projectId, nodeId, {
          node: {
            type: node.type ?? "image-engine",
            modelKey,
            data: runData,
            imageInputs,
            textInputs,
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
        const nodesNow = useCanvasStore.getState().nodes;
        const nodeNow = nodesNow.find((n) => n.id === nodeId) ?? node;
        if (
          r.task.status === "SUCCEEDED" &&
          (r.task.textOutput || pickTaskResultMediaUrl(r.task))
        ) {
          if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
            storyApplyTaskResult(
              nodeNow,
              r.task,
              job,
              updateNodeData,
              nodesNow,
            );
          } else if (
            applySbv1ImageTaskResult(nodeNow, r.task, updateNodeData)
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
          if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
            storyApplyTaskResult(
              nodeNow,
              r.task,
              job,
              updateNodeData,
              nodesNow,
            );
          } else if (
            applySbv1ImageTaskResult(nodeNow, r.task, updateNodeData)
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
            if (shouldApplyCanvasTaskRuntimePatch(localRt, r.task, errorPatch)) {
              setNodeRuntime(nodeId, errorPatch);
            }
          }
        } else if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
          storyApplyTaskResult(
            nodeNow,
            r.task,
            job,
            updateNodeData,
            nodesNow,
          );
        } else if (applySbv1ImageTaskResult(nodeNow, r.task, updateNodeData)) {
          /* pending / running */
        } else {
          setNodeRuntime(nodeId, {
            status: "running",
            taskId: r.task.id,
          });
          void listCanvasProjectTasks(base, projectId, [nodeId])
            .then((tasks) => {
              const scope =
                job.rowKey || job.mediaKind || job.llmSection
                  ? {
                      rowKey: job.rowKey,
                      mediaKind: job.mediaKind,
                      llmSection: job.llmSection,
                    }
                  : undefined;
              const latest = scope
                ? pickPreferredCanvasTaskForScope(tasks, scope)
                : pickPreferredCanvasTask(tasks);
              if (!latest) return;
              const n = useCanvasStore.getState().nodes.find((x) => x.id === nodeId);
              if (!n) return;
              storyApplyTaskResult(n, latest, job, updateNodeData, useCanvasStore.getState().nodes);
            })
            .catch(() => {});
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
            const scoped = tasks.filter((t) => t.nodeId === nodeId);
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
              if (isStoryWorkspaceNodeType(nodeNow.type ?? "")) {
                storyApplyTaskResult(
                  nodeNow,
                  pick,
                  job,
                  updateNodeData,
                  useCanvasStore.getState().nodes,
                );
              } else if (applySbv1ImageTaskResult(nodeNow, pick, updateNodeData)) {
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
                if (shouldApplyCanvasTaskRuntimePatch(localRt, pick, errorPatch)) {
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
        } else if (
          !applySbv1ImageRunFailure(
            errNode,
            updateNodeData,
            "REQUEST_FAILED",
            msg,
          )
        ) {
          setNodeRuntime(nodeId, {
            status: "error",
            failCode: "REQUEST_FAILED",
            failMessage: formatCanvasTaskError("REQUEST_FAILED", msg),
          });
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
            } else if (rowErr || (node && nodeRuntimeStatus(node) === "error")) {
              abortSequentialOnError(key);
            } else {
              finishSequentialStep(key);
            }
          }
        }
        drainRef.current();
      }
    },
    [
      abortSequential,
      abortSequentialOnError,
      base,
      finishSequentialStep,
      projectId,
      releaseInflightKey,
      setNodeRuntime,
      updateNodeData,
    ],
  );

  const drain = useCallback(() => {
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0]!;
      const key = runKey(item);
      if (inflightRef.current.has(key)) break;
      queueRef.current.shift();
      inflightRef.current.add(key);
      void runOne(item);
    }
  }, [runOne]);

  useEffect(() => {
    drainRef.current = drain;
  }, [drain]);

  const enqueueStoryRun = useCallback(
    (job: QueueItem) => {
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
        return;
      }
      const key = runKey(job);
      if (job.forceFresh) {
        queueRef.current = queueRef.current.filter((q) => runKey(q) !== key);
        if (inflightRef.current.has(key)) {
          deferredForceFreshRef.current.set(key, job);
          const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
          if (node) {
            if (
              !commitStoryRunPendingPatch(
                node,
                job,
                useCanvasStore.getState().nodes,
                updateNodeData,
              ) &&
              !commitLibtvMediaRunPendingPatch(node, updateNodeData)
            ) {
              setNodeRuntime(job.nodeId, {
                status: "pending",
                failCode: undefined,
                failMessage: undefined,
              });
            }
          }
          return;
        }
      }
      if (inflightRef.current.has(key)) return;
      if (queueRef.current.some((q) => runKey(q) === key)) return;
      const node = useCanvasStore.getState().nodes.find((n) => n.id === job.nodeId);
      if (
        node &&
        isAnyStoryScriptHubType(node.type ?? "") &&
        job.llmSection
      ) {
        const st = hubSectionRuntime(node, job.llmSection)?.status;
        if (isCanvasInflightStatus(st)) return;
      }
      const rowSt = storyRowRuntimeStatus(node, job);
      if (
        !job.forceFresh &&
        (rowSt === "running" || rowSt === "pending" || rowSt === "queued")
      ) {
        return;
      }
      detachNodeTaskRefs(job);
      if (node) {
        const nodesNow = useCanvasStore.getState().nodes;
        if (
          !commitStoryRunPendingPatch(node, job, nodesNow, updateNodeData) &&
          !commitLibtvMediaRunPendingPatch(node, updateNodeData)
        ) {
          setNodeRuntime(job.nodeId, {
            status: "pending",
            failCode: undefined,
            failMessage: undefined,
          });
        }
      }
      queueRef.current.push(job);
      drain();
    },
    [drain, setNodeRuntime, updateNodeData, gatewayLinkAccountUrl, gatewayLinkBlocked, detachNodeTaskRefs],
  );

  const enqueueNode = useCallback(
    (nodeId: string, forceFresh?: boolean) => {
      enqueueStoryRun({ nodeId, forceFresh });
    },
    [enqueueStoryRun],
  );

  const enqueueNodesSequential = useCallback(
    (nodeIds: string[], forceFresh?: boolean) => {
      if (!nodeIds.length) return;
      sequentialRef.current = {
        jobs: nodeIds.map((nodeId) => ({ nodeId, forceFresh })),
        cursor: 0,
        forceFresh,
        activeKey: null,
      };
      pumpSequential();
    },
    [pumpSequential],
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

      const runnable = deduped.filter((job) => {
        const key = runKey(job);
        if (inflightRef.current.has(key)) return false;
        if (queueRef.current.some((q) => runKey(q) === key)) return false;
        return true;
      });
      if (!runnable.length) return;

      const seq = sequentialRef.current;
      if (seq && (seq.activeKey || seq.cursor < seq.jobs.length)) {
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
      pumpSequential();
    },
    [pumpSequential],
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

  useEffect(() => {
    registerCanvasRunBus({
      enqueueNode: (nodeId, forceFresh) =>
        enqueueStoryRunRef.current({ nodeId, forceFresh }),
      enqueueStoryRun: (job) => enqueueStoryRunRef.current(job),
      enqueueNodesSequential: (nodeIds, opts) =>
        enqueueNodesSequentialRef.current(nodeIds, opts?.forceFresh),
      enqueueStoryRunsSequential: (jobs, opts) =>
        enqueueStoryRunsSequentialRef.current(jobs, opts?.forceFresh),
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
        done = hubSectionIsComplete(node, job.llmSection);
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
      const key = runKey(job);
      const rowErr =
        job.rowKey && storyRowRuntimeStatus(node, job) === "error";
      if (rowErr && job.mediaKind === "sceneRef") {
        finishSequentialStep(key);
        return;
      }
      if (rowErr || nodeRuntimeStatus(node) === "error") {
        abortSequentialOnError(key);
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
    let intervalId = 0;
    let tickCount = 0;
    const serverInflightRef = { current: false };
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
        if (shouldSkipStoryRowTaskApply(localRuntime, pick)) return;
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
            const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
            if (!pick) continue;
            const job: CanvasStoryRunJob =
              jobByTaskRef.current.get(pick.id) ??
              storyRunContextFromScope(node.id, scope);
            storyApplyTaskResult(node, pick, job, updateNodeData, nodes);
            if (pick.status === "SUCCEEDED" || pick.status === "FAILED") {
              releaseInflightKey(runKey(job));
            }
          }
          continue;
        }

        if (isAnyStorySceneColumnType(node.type ?? "")) {
          const rows =
            (node.data as { rows?: { key: string }[] }).rows ?? [];
          for (const row of rows) {
            const scope = { rowKey: row.key, mediaKind: "sceneRef" as const };
            const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
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
            const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
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
            const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
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
              const pick = pickPreferredCanvasTaskForScope(nodeTasks, scope);
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
        if (job) {
          if (
            job.llmSection &&
            (t.status === "SUBMITTED" ||
              t.status === "DISPATCHING" ||
              t.status === "PENDING" ||
              t.status === "QUEUED") &&
            hubSectionIsComplete(node, job.llmSection) &&
            !isCanvasInflightStatus(hubSectionRuntime(node, job.llmSection)?.status)
          ) {
            return;
          }
          storyApplyTaskResult(node, t, job, updateNodeData, nodes);
        } else {
          const scope = t.storyScope ?? {};
          if (scope.llmSection || scope.rowKey || scope.mediaKind) {
            storyApplyTaskResult(
              node,
              t,
              storyRunContextFromScope(nodeId, scope),
              updateNodeData,
              nodes,
            );
          }
        }
        return;
      }

      const localSt = node ? nodeRuntimeStatus(node) : undefined;
      let boundTaskId: string | undefined;
      for (const [k, tid] of Array.from(taskByNodeRef.current.entries())) {
        if (k.startsWith(`${nodeId}:`) || k === nodeId) {
          if (tid === t.id) boundTaskId = tid;
        }
      }
      boundTaskId ??= taskByNodeRef.current.get(nodeId);
      const isTerminal =
        t.status === "SUCCEEDED" || t.status === "FAILED";
      // 本地 pending/running 时，列表「最新」可能仍是上一轮终态任务
      if (isLocalInflightStatus(localSt) && isTerminal) {
        if (!jobByTaskRef.current.has(t.id)) return;
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
          updateNodeData(nodeId, sbv1Patch);
          const st = (sbv1Patch.runtime as CanvasNodeRuntime | undefined)?.status;
          if (st === "done" || st === "error") {
            const job = jobByTaskRef.current.get(t.id);
            if (job) releaseInflightKey(runKey(job));
            if (st === "done") maybeNotifyCanvasCreditsSettled(t);
          }
        }
        return;
      }
      if (patch) {
        const localRt = node
          ? (node.data as { runtime?: CanvasNodeRuntime }).runtime
          : undefined;
        if (!shouldApplyCanvasTaskRuntimePatch(localRt, t, patch)) return;
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
        if (patch.status === "done" || patch.status === "error") {
          const job = jobByTaskRef.current.get(t.id);
          if (job) releaseInflightKey(runKey(job));
          if (patch.status === "done") maybeNotifyCanvasCreditsSettled(t);
        }
      }
    };

    const tick = async (forceFullScan = false) => {
      if (cancelled || pollStopped) return;
      tickCount++;
      const periodicFullScan =
        !forceFullScan && tickCount % FULL_SCAN_EVERY_N_TICKS === 0;
      const fullScan = forceFullScan || periodicFullScan;

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
        const nodesNow = useCanvasStore.getState().nodes;
        applyStoryColumnRowTasks(tasks, nodesNow);
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
        const latestByNode = latestTasksByNode(tasks);
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
          if (intervalId) window.clearInterval(intervalId);
        }
      }
    };

    intervalId = window.setInterval(() => void tick(), POLL_INTERVAL_MS);
    void tick(false);
    const fullScanTimer = window.setTimeout(
      () => void tick(true),
      INITIAL_FULL_SCAN_DELAY_MS,
    );
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
      window.clearTimeout(fullScanTimer);
    };
  }, [base, projectId, releaseInflightKey, setNodeRuntime, updateNodeData]);

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
