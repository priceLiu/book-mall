"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  applyCharacterRowRuntime,
  applyFrameRowRuntime,
  applyHubSectionFromTask,
  applySceneRowRuntime,
  applyVideoRowRuntime,
} from "./story-row-patch";
import {
  syncColumnsFromHub,
  syncDownstreamMediaColumns,
} from "./story-column-sync";
import { syncProductionScaffoldDataToHubFromStore } from "./hydrate-production-scaffold";
import {
  hubSectionIsRunning,
  hubSectionRuntime,
  hubHasDisplayableScriptContent,
  shouldSkipHubSectionInflightTaskApply,
} from "./story-hub-runtime";
import { isCanvasInflightStatus } from "./story-column-runtime";
import type {
  StoryLlmSection,
  StoryRunContext,
  StoryScriptHubNodeData,
} from "./story-workspace-types";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { formatCanvasTaskError } from "./friendly-task-error";
import {
  canvasIdleRuntimeAfterUserCancel,
  isUserCancelledCanvasTask,
} from "./canvas-generation-cancel-messages";
import { applyScriptStudioThemeOutlineResult } from "./script-studio-run-apply";
import { pickTaskResultMediaUrl } from "./task-media-url";
import { shouldSkipStoryRowTaskApply } from "./task-pick";
import { clearCanvasNodeRunSession } from "./canvas-run-session";
import { buildStoryProStyleDraftApplyPatch } from "./story-pro-style-draft";
import {
  syncPro2CharacterImagesFromRows,
} from "./pro2-spawn-character-image-group";
import {
  reconcilePro2FrameNodesWithColumnRows,
  reconcilePro2ThreeViewNodesWithColumnRows,
} from "./pro2-group-row-resolve";
import { syncPro2FrameImagesFromRows } from "./pro2-spawn-frame-image-group";
import { syncPro2VideoBoardFromRows } from "./pro2-spawn-video-board-group";
import { syncPro2SceneImagesFromRows } from "./pro2-spawn-scene-image-group";
import { requestCanvasGraphPersistFlush } from "./canvas-persist-request";
import { buildProductionScriptOriginPatch } from "./pro2-production-script-origin";
import { tryPersistPro2HubMediaFromColumns } from "./pro2-hub-media-persist";
import { isPro2StoryOutlineTextNode } from "./pro2-text-purpose";
import type {
  StoryProCharacterRow,
  StoryProFrameRow,
  StoryProSceneRow,
  StoryProScriptHubNodeData,
  StoryProVideoRow,
} from "./story-pro-workspace-types";
import {
  findStarterByHubId,
  isAnyStoryCharacterColumnType,
  isAnyStoryFrameColumnType,
  isAnyStorySceneColumnType,
  isAnyStoryScriptHubType,
  isAnyStoryVideoColumnType,
} from "./story-workspace-resolver";

function hubSectionPatchChanged(
  prev: StoryScriptHubNodeData,
  section: StoryLlmSection,
  patch: Partial<StoryScriptHubNodeData>,
): boolean {
  const rtKey =
    section === "outline"
      ? "outlineRuntime"
      : section === "character"
        ? "characterRuntime"
        : section === "scene"
          ? "sceneRuntime"
          : "storyboardRuntime";
  const mdKey =
    section === "outline"
      ? "outlineMd"
      : section === "character"
        ? "characterMd"
        : section === "scene"
          ? "sceneMd"
          : "storyboardMd";
  const prevRt = prev[rtKey as keyof StoryScriptHubNodeData];
  const nextRt = patch[rtKey as keyof StoryScriptHubNodeData];
  const prevMd = prev[mdKey as keyof StoryScriptHubNodeData];
  const nextMd = patch[mdKey as keyof StoryScriptHubNodeData];
  if (JSON.stringify(prevRt) !== JSON.stringify(nextRt)) return true;
  if (typeof nextMd === "string" && nextMd !== prevMd) return true;

  const prevPro2 = prev as StoryProScriptHubNodeData;
  const nextPro2 = patch as Partial<StoryProScriptHubNodeData>;
  if (
    nextPro2.productionScript != null &&
    JSON.stringify(prevPro2.productionScript) !==
      JSON.stringify(nextPro2.productionScript)
  ) {
    return true;
  }
  if (
    typeof nextPro2.outlineMd === "string" &&
    nextPro2.outlineMd !== (prev.outlineMd ?? "")
  ) {
    return true;
  }
  if (
    typeof nextPro2.characterMd === "string" &&
    nextPro2.characterMd !== (prev.characterMd ?? "")
  ) {
    return true;
  }
  if (
    typeof nextPro2.sceneMd === "string" &&
    nextPro2.sceneMd !== (prev.sceneMd ?? "")
  ) {
    return true;
  }
  if (
    typeof nextPro2.storyboardMd === "string" &&
    nextPro2.storyboardMd !== (prev.storyboardMd ?? "")
  ) {
    return true;
  }
  if (
    nextPro2.scriptStudioFrameRows != null &&
    JSON.stringify(prevPro2.scriptStudioFrameRows ?? []) !==
      JSON.stringify(nextPro2.scriptStudioFrameRows)
  ) {
    return true;
  }
  if (
    nextPro2.scriptStudioCharacterRows != null &&
    JSON.stringify(prevPro2.scriptStudioCharacterRows ?? []) !==
      JSON.stringify(nextPro2.scriptStudioCharacterRows)
  ) {
    return true;
  }
  return false;
}

const STORY_ROW_PENDING_RUNTIME: CanvasNodeRuntime = {
  status: "pending",
};

export function storyRunPendingPatch(
  node: CanvasFlowNode,
  ctx?: StoryRunContext,
): Record<string, unknown> | null {
  if (
    (node.type === "story-pro2-starter" ||
      node.type === "story-pro2-prompt" ||
      node.type === "story-pro-starter") &&
    ctx?.mediaKind === "generalText"
  ) {
    if (
      node.type === "story-pro2-starter" &&
      isPro2StoryOutlineTextNode((node.data ?? {}) as Record<string, unknown>)
    ) {
      return null;
    }
    return {
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }
  if (
    (node.type === "story-pro2-starter" || node.type === "story-pro-starter") &&
    ctx?.mediaKind === "themeOutline"
  ) {
    if (
      node.type === "story-pro2-starter" &&
      !isPro2StoryOutlineTextNode((node.data ?? {}) as Record<string, unknown>)
    ) {
      return null;
    }
    return {
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }
  if (isAnyStoryScriptHubType(node.type ?? "") && ctx?.llmSection) {
    const rt: CanvasNodeRuntime = {
      status: "pending",
      failCode: undefined,
      failMessage: undefined,
    };
    if (ctx.llmSection === "outline") return { outlineRuntime: rt };
    if (ctx.llmSection === "character") return { characterRuntime: rt };
    if (ctx.llmSection === "scene") return { sceneRuntime: rt };
    if (ctx.llmSection === "shot_prompts") return null;
    return { storyboardRuntime: rt };
  }
  if (isAnyStorySceneColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows?: StoryProSceneRow[] }).rows;
    if (!rows) return null;
    return {
      rows: applySceneRowRuntime(rows, ctx.rowKey, STORY_ROW_PENDING_RUNTIME),
    };
  }
  if (isAnyStoryCharacterColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
      .rows;
    if (!rows) return null;
    return {
      rows: applyCharacterRowRuntime(
        rows as never,
        ctx.rowKey,
        STORY_ROW_PENDING_RUNTIME,
      ),
    };
  }
  if (
    isAnyStoryFrameColumnType(node.type ?? "") &&
    ctx?.rowKey
  ) {
    const rows = (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
      .rows;
    if (!rows) return null;
    return {
      rows: applyFrameRowRuntime(
        rows as never,
        ctx.rowKey,
        STORY_ROW_PENDING_RUNTIME,
      ),
    };
  }
  if (isAnyStoryVideoColumnType(node.type ?? "") && ctx?.rowKey && ctx.mediaKind) {
    const rows = (node.data as { rows?: { key: string }[] }).rows;
    if (!rows) return null;
    return {
      rows: applyVideoRowRuntime(
        rows as never,
        ctx.rowKey,
        ctx.mediaKind === "tts" ? "tts" : "video",
        STORY_ROW_PENDING_RUNTIME,
      ),
    };
  }
  if (node.type === "sbv1-image") {
    return {
      uploading: true,
      uploadError: undefined,
      runtime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
      } satisfies CanvasNodeRuntime,
    };
  }
  return null;
}

/** 用户中止 · 清除 pending/running 行态或段级 runtime（与 storyRunPendingPatch 对称） */
export function storyRunCancelPatch(
  node: CanvasFlowNode,
  ctx?: StoryRunContext,
  taskId?: string,
): Record<string, unknown> | null {
  const idle = canvasIdleRuntimeAfterUserCancel(taskId);
  if (
    (node.type === "story-pro2-starter" ||
      node.type === "story-pro2-prompt" ||
      node.type === "story-pro-starter") &&
    (ctx?.mediaKind === "generalText" || ctx?.mediaKind === "themeOutline")
  ) {
    return { themeOutlineRuntime: idle };
  }
  if (isAnyStoryScriptHubType(node.type ?? "") && ctx?.llmSection) {
    if (ctx.llmSection === "outline") return { outlineRuntime: idle };
    if (ctx.llmSection === "character") return { characterRuntime: idle };
    if (ctx.llmSection === "scene") return { sceneRuntime: idle };
    if (ctx.llmSection === "shot_prompts") return null;
    return { storyboardRuntime: idle };
  }
  if (isAnyStorySceneColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows?: StoryProSceneRow[] }).rows;
    if (!rows) return null;
    return { rows: applySceneRowRuntime(rows, ctx.rowKey, idle) };
  }
  if (isAnyStoryCharacterColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows?: { key: string }[] }).rows;
    if (!rows) return null;
    return {
      rows: applyCharacterRowRuntime(rows as never, ctx.rowKey, idle),
    };
  }
  if (isAnyStoryFrameColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows?: { key: string }[] }).rows;
    if (!rows) return null;
    return {
      rows: applyFrameRowRuntime(rows as never, ctx.rowKey, idle),
    };
  }
  if (isAnyStoryVideoColumnType(node.type ?? "") && ctx?.rowKey && ctx.mediaKind) {
    const rows = (node.data as { rows?: { key: string }[] }).rows;
    if (!rows) return null;
    return {
      rows: applyVideoRowRuntime(
        rows as never,
        ctx.rowKey,
        ctx.mediaKind === "tts" ? "tts" : "video",
        idle,
      ),
    };
  }
  if (node.type === "sbv1-image") {
    return {
      uploading: false,
      uploadError: undefined,
      runtime: idle,
    };
  }
  return null;
}

export function commitStoryRunCancelLocal(
  node: CanvasFlowNode,
  ctx: StoryRunContext | undefined,
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  taskId?: string,
): boolean {
  const patch = storyRunCancelPatch(node, ctx, taskId);
  if (!patch) return false;
  if (isAnyStoryScriptHubType(node.type ?? "") && ctx?.llmSection) {
    updateNodeData(node.id, { ...patch, hubGenerateIntent: undefined });
    return true;
  }
  updateNodeData(node.id, patch);
  if (
    isAnyStoryCharacterColumnType(node.type ?? "") &&
    ctx?.rowKey &&
    Array.isArray(patch.rows)
  ) {
    const touched = (patch.rows as StoryProCharacterRow[]).find(
      (r) => r.key === ctx.rowKey,
    );
    if (touched) {
      syncPro2CharacterImagesFromRows(
        allNodes.map((n) =>
          n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n,
        ),
        node.id,
        [touched],
        updateNodeData,
        { inflightOnly: true },
      );
    }
  }
  if (
    isAnyStoryFrameColumnType(node.type ?? "") &&
    Array.isArray(patch.rows) &&
    ctx?.rowKey
  ) {
    syncPro2FrameImagesFromRows(
      allNodes,
      node.id,
      patch.rows as StoryProFrameRow[],
      updateNodeData,
    );
  }
  if (
    isAnyStoryVideoColumnType(node.type ?? "") &&
    Array.isArray(patch.rows)
  ) {
    syncPro2VideoBoardFromRows(
      allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n,
      ),
      node.id,
      patch.rows as never,
      updateNodeData,
    );
  }
  return true;
}

function syncPro2SceneColumnVisuals(
  node: CanvasFlowNode,
  nextRows: StoryProSceneRow[],
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  syncPro2SceneImagesFromRows(
    allNodes.map((n) =>
      n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
    ),
    node.id,
    nextRows,
    updateNodeData,
  );
}

/** 写入 pending 行状态，并同步 Pro2 场景图组内子节点的扫光态 */
export function commitStoryRunPendingPatch(
  node: CanvasFlowNode,
  ctx: StoryRunContext | undefined,
  allNodes: CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  const pending = storyRunPendingPatch(node, ctx);
  if (!pending) return false;
  updateNodeData(node.id, pending);
  if (
    isAnyStorySceneColumnType(node.type ?? "") &&
    Array.isArray(pending.rows)
  ) {
    syncPro2SceneColumnVisuals(
      node,
      pending.rows as StoryProSceneRow[],
      allNodes,
      updateNodeData,
    );
  }
  if (
    isAnyStoryFrameColumnType(node.type ?? "") &&
    Array.isArray(pending.rows) &&
    ctx?.rowKey
  ) {
    syncPro2FrameImagesFromRows(
      allNodes,
      node.id,
      pending.rows as StoryProFrameRow[],
      updateNodeData,
    );
  }
  if (
    isAnyStoryCharacterColumnType(node.type ?? "") &&
    Array.isArray(pending.rows) &&
    ctx?.rowKey
  ) {
    const touched = (pending.rows as StoryProCharacterRow[]).find(
      (r) => r.key === ctx.rowKey,
    );
    if (touched) {
      syncPro2CharacterImagesFromRows(
        allNodes.map((n) =>
          n.id === node.id
            ? { ...n, data: { ...n.data, rows: pending.rows } }
            : n,
        ),
        node.id,
        [touched],
        updateNodeData,
        { inflightOnly: true },
      );
    }
  }
  if (
    isAnyStoryVideoColumnType(node.type ?? "") &&
    Array.isArray(pending.rows)
  ) {
    syncPro2VideoBoardFromRows(
      allNodes.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, rows: pending.rows } }
          : n,
      ),
      node.id,
      pending.rows as never,
      updateNodeData,
    );
  }
  return true;
}

export function storyApplyTaskResult(
  node: CanvasFlowNode,
  task: CanvasTaskRecord,
  ctx: StoryRunContext | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  allNodes: CanvasFlowNode[],
): void {
  const mediaUrl = pickTaskResultMediaUrl(task) ?? task.ossUrl ?? undefined;
  const runtime: CanvasNodeRuntime =
    task.status === "SUCCEEDED"
      ? {
          status: "done",
          taskId: task.id,
          ossUrl: mediaUrl ?? undefined,
          ephemeralUrl: task.ephemeralUrl ?? undefined,
          textOutput: task.textOutput ?? undefined,
          failCode: undefined,
          failMessage: undefined,
        }
      : task.status === "FAILED"
        ? {
            status: "error",
            taskId: task.id,
            failCode: task.failCode ?? "FAILED",
            failMessage: formatCanvasTaskError(
              task.failCode,
              task.failMessage,
              task.model,
            ),
          }
        : task.status === "CANCELLED"
          ? isUserCancelledCanvasTask(task)
            ? canvasIdleRuntimeAfterUserCancel(task.id)
            : {
                status: "error",
                taskId: task.id,
                failCode: task.failCode ?? "CANCELLED",
                failMessage: formatCanvasTaskError(
                  task.failCode,
                  task.failMessage,
                  task.model,
                ),
              }
          : task.status === "SUBMITTED"
            ? {
                status: "running",
                taskId: task.id,
                failCode: undefined,
                failMessage: undefined,
              }
            : {
                status: "pending",
                taskId: task.id,
                failCode: undefined,
                failMessage: undefined,
              };

  const isStarterTextNode =
    node.type === "story-pro2-starter" || node.type === "story-pro-starter";
  const isPromptTextNode = node.type === "story-pro2-prompt";
  const isGeneralLlmTextNode = isStarterTextNode || isPromptTextNode;
  const isOutlineTextNode =
    isStarterTextNode &&
    isPro2StoryOutlineTextNode((node.data ?? {}) as Record<string, unknown>);
  // 轮询偶发缺 storyScope.mediaKind：按节点用途推断，避免 Gateway 已成功但 UI 一直生成中
  const starterMediaKind =
    ctx?.mediaKind === "themeOutline" || ctx?.mediaKind === "generalText"
      ? ctx.mediaKind
      : isGeneralLlmTextNode ||
          (node.type === "story-pro2-script-hub" &&
            (node.data as { scriptStudioMode?: boolean }).scriptStudioMode ===
              true)
        ? isOutlineTextNode
          ? ("themeOutline" as const)
          : ("generalText" as const)
        : undefined;

  if (
    (isStarterTextNode || node.type === "story-pro2-script-hub") &&
    starterMediaKind === "themeOutline"
  ) {
    const hubStudio =
      node.type === "story-pro2-script-hub" &&
      (node.data as { scriptStudioMode?: boolean }).scriptStudioMode === true;
    // 用途不匹配时：进行中可忽略；终态仍写回 runtime，避免卡在「生成中」
    if (
      node.type === "story-pro2-starter" &&
      !isOutlineTextNode &&
      task.status !== "SUCCEEDED" &&
      task.status !== "FAILED" &&
      task.status !== "CANCELLED"
    ) {
      return;
    }
    if (node.type === "story-pro2-script-hub" && !hubStudio) {
      return;
    }
    const prevRt = (
      node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
    ).themeOutlineRuntime;
    if (shouldSkipStoryRowTaskApply(prevRt, task, node.id)) return;
    const patch: Record<string, unknown> = { themeOutlineRuntime: runtime };
    if (task.status === "SUCCEEDED" && task.textOutput?.trim()) {
      if (isStarterTextNode) {
        patch.generatedOutlineMd = task.textOutput.trim();
        if (isOutlineTextNode) {
          patch.pipelineStage = "llm_done";
          patch.starterMode = "generate";
        }
      }
    }
    updateNodeData(node.id, patch);
    if (
      task.status === "SUCCEEDED" &&
      task.textOutput?.trim() &&
      isOutlineTextNode
    ) {
      applyScriptStudioThemeOutlineResult(
        node,
        task.textOutput.trim(),
        allNodes,
        updateNodeData,
      );
    }
    return;
  }

  if (isGeneralLlmTextNode && starterMediaKind === "generalText") {
    if (
      isStarterTextNode &&
      isOutlineTextNode &&
      task.status !== "SUCCEEDED" &&
      task.status !== "FAILED" &&
      task.status !== "CANCELLED"
    ) {
      return;
    }
    const prevRt = (
      node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
    ).themeOutlineRuntime;
    if (shouldSkipStoryRowTaskApply(prevRt, task, node.id)) return;
    const patch: Record<string, unknown> = { themeOutlineRuntime: runtime };
    if (task.status === "SUCCEEDED" && task.textOutput?.trim()) {
      if (isPromptTextNode) {
        patch.generatedText = task.textOutput.trim();
      } else if (isStarterTextNode) {
        patch.generatedOutlineMd = task.textOutput.trim();
        if (isOutlineTextNode) {
          patch.pipelineStage = "llm_done";
          patch.starterMode = "generate";
        }
      }
    }
    updateNodeData(node.id, patch);
    return;
  }

  const hubLlmSection =
    ctx?.llmSection ??
    (task.storyScope?.llmSection as StoryLlmSection | undefined) ??
    (node.type === "story-pro2-script-hub" ? ("outline" as const) : undefined);

  if (isAnyStoryScriptHubType(node.type ?? "") && hubLlmSection) {
    if (shouldSkipHubSectionInflightTaskApply(node, hubLlmSection, task)) {
      return;
    }
    const prevRt = hubSectionRuntime(node, hubLlmSection);
    // 同节点新任务在跑时，勿把 SUPERSEDED / 旧 FAILED 写回 Hub（否则扫光消失、回到空态）
    if (
      task.status === "FAILED" ||
      task.status === "CANCELLED"
    ) {
      if (task.failCode === "SUPERSEDED") return;
      if (
        isCanvasNodeRunSessionActive(node.id) &&
        isCanvasInflightStatus(prevRt?.status) &&
        prevRt?.taskId !== task.id
      ) {
        return;
      }
      if (
        isCanvasNodeRunSessionActive(node.id) &&
        isCanvasInflightStatus(prevRt?.status) &&
        !prevRt?.taskId?.trim()
      ) {
        return;
      }
    }
    if (shouldSkipStoryRowTaskApply(prevRt, task, node.id)) return;
    const prev = node.data as unknown as StoryScriptHubNodeData;
    const patch = applyHubSectionFromTask(
      prev,
      hubLlmSection,
      runtime,
      task.textOutput ?? undefined,
    );
    if (!hubSectionPatchChanged(prev, hubLlmSection, patch)) return;
    let hubPatch = patch as Partial<StoryProScriptHubNodeData>;
    if (
      task.status === "SUCCEEDED" &&
      task.textOutput?.trim() &&
      node.type === "story-pro2-script-hub"
    ) {
      const originPatch = buildProductionScriptOriginPatch(
        prev as StoryProScriptHubNodeData,
        hubLlmSection,
        runtime,
        task.textOutput,
        hubPatch,
      );
      hubPatch = { ...hubPatch, ...originPatch };
    }
    const mergedHubData = {
      ...(prev as StoryProScriptHubNodeData),
      ...hubPatch,
    };
    const terminalHubTask =
      task.status === "SUCCEEDED" ||
      task.status === "FAILED" ||
      task.status === "CANCELLED";
    // SUCCEEDED：须等剧本内容落库后再清 intent / 会话，避免「已链接」空态闪一下
    const clearHubGenerateIntent =
      task.status === "SUCCEEDED"
        ? hubHasDisplayableScriptContent(mergedHubData)
        : task.status === "CANCELLED" && task.failCode !== "SUPERSEDED"
          ? true
          : task.status === "FAILED" &&
              task.failCode !== "SUPERSEDED" &&
              (!isCanvasNodeRunSessionActive(node.id) ||
                Boolean(prevRt?.taskId?.trim() && prevRt.taskId === task.id));
    const hubPatchWithIntentClear = clearHubGenerateIntent
      ? ({ ...hubPatch, hubGenerateIntent: undefined } as typeof hubPatch)
      : hubPatch;
    updateNodeData(node.id, hubPatchWithIntentClear);
    if (
      task.status === "SUCCEEDED" &&
      node.type === "story-pro2-script-hub"
    ) {
      requestCanvasGraphPersistFlush({ immediate: true });
      syncProductionScaffoldDataToHubFromStore(node.id);
    }
    if (terminalHubTask) {
      const mergedNode: CanvasFlowNode = {
        ...node,
        data: { ...node.data, ...hubPatchWithIntentClear },
      };
      const stillRunning = (
        ["outline", "character", "scene", "storyboard"] as const
      ).some((s) => hubSectionIsRunning(mergedNode, s));
      const hubReady =
        task.status === "SUCCEEDED"
          ? hubHasDisplayableScriptContent({
              ...(mergedNode.data as StoryProScriptHubNodeData),
            })
          : true;
      if (!stillRunning && hubReady) clearCanvasNodeRunSession(node.id);
    }
    const starter = findStarterByHubId(allNodes, node.id);
    const ws = (
      starter?.data as {
        workspaceIds?: {
          scriptHubId: string;
          characterColumnId: string;
          frameColumnId: string;
          videoColumnId: string;
        };
      }
    )?.workspaceIds;
    if (ws?.scriptHubId === node.id && task.textOutput) {
      const nodesAfterHub = allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, ...hubPatch } } : n,
      );
      const mergedHubData = {
        ...node.data,
        ...hubPatch,
      } as import("./story-pro-workspace-types").StoryProScriptHubNodeData;

      if (
        ws.characterColumnId &&
        ws.frameColumnId &&
        ws.videoColumnId
      ) {
        const synced = syncColumnsFromHub(
          nodesAfterHub,
          node.id,
          ws.characterColumnId,
          ws.frameColumnId,
          ws.videoColumnId,
        );
        if (synced) {
          if (node.type !== "story-pro2-script-hub") {
            updateNodeData(ws.characterColumnId, synced.characterPatch);
          }
          updateNodeData(ws.frameColumnId, synced.framePatch);
          updateNodeData(ws.videoColumnId, synced.videoPatch);
        }
      }

      if (starter && starter.data) {
        const stage = (starter.data as { pipelineStage?: string }).pipelineStage;
        if (stage === "finalized") {
          /* 已定稿后不再改阶段 */
        } else if (hubLlmSection === "storyboard") {
          updateNodeData(starter.id, { pipelineStage: "llm_done" });
        }
      }
    }
    return;
  }

  if (isAnyStorySceneColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows?: StoryProSceneRow[] }).rows ?? [];
    const nextRows = applySceneRowRuntime(rows, ctx.rowKey, runtime);
    updateNodeData(node.id, { rows: nextRows });
    syncPro2SceneColumnVisuals(
      node,
      nextRows,
      allNodes,
      updateNodeData,
    );
    return;
  }

  if (isAnyStoryCharacterColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows: { key: string }[] }).rows ?? [];
    const nextRows = applyCharacterRowRuntime(
      rows as never,
      ctx.rowKey,
      runtime,
    );
    updateNodeData(node.id, { rows: nextRows });
    const touched = (nextRows as StoryProCharacterRow[]).find(
      (r) => r.key === ctx.rowKey,
    );
    if (touched) {
      const nodesAfter = allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
      );
      syncPro2CharacterImagesFromRows(
        nodesAfter,
        node.id,
        [touched],
        updateNodeData,
        { inflightOnly: true },
      );
      if (runtime.status === "done" || runtime.status === "error") {
        reconcilePro2ThreeViewNodesWithColumnRows(
          nodesAfter,
          node.id,
          updateNodeData,
        );
        clearCanvasNodeRunSession(node.id);
      }
    }
    const pendingSyncGroupId = (
      node.data as { pro2PendingSyncGroupId?: string }
    ).pro2PendingSyncGroupId?.trim();
    if (pendingSyncGroupId) {
      const anyInflight = (nextRows as { runtime?: { status?: string } }[]).some(
        (r) =>
          r.runtime?.status === "pending" ||
          r.runtime?.status === "running" ||
          r.runtime?.status === "queued",
      );
      if (!anyInflight) {
        updateNodeData(node.id, {
          pro2PendingSyncGroupId: undefined,
          pro2VisualGroupId: pendingSyncGroupId,
        });
      }
    }
    const starter = findStarterByHubId(allNodes, node.id);
    const ws = (
      starter?.data as {
        workspaceIds?: {
          scriptHubId: string;
          characterColumnId: string;
          frameColumnId: string;
          videoColumnId: string;
        };
      }
    )?.workspaceIds;
    if (
      ws?.scriptHubId &&
      ws.characterColumnId &&
      ws.frameColumnId &&
      ws.videoColumnId &&
      (runtime.status === "done" || Boolean(mediaUrl))
    ) {
      const nodesAfter = allNodes.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, rows: nextRows } }
          : n,
      );
      const downstream = syncDownstreamMediaColumns(
        nodesAfter,
        ws.scriptHubId,
        ws.characterColumnId,
        ws.frameColumnId,
        ws.videoColumnId,
      );
      if (downstream) {
        updateNodeData(ws.frameColumnId, downstream.framePatch);
        updateNodeData(ws.videoColumnId, downstream.videoPatch);
      }
    }
    if (starter && runtime.status === "done") {
      updateNodeData(starter.id, { pipelineStage: "tv_done" });
    }
    return;
  }

  if (isAnyStoryFrameColumnType(node.type ?? "") && ctx?.rowKey) {
    const rows = (node.data as { rows: { key: string }[] }).rows ?? [];
    const nextRows = applyFrameRowRuntime(rows as never, ctx.rowKey, runtime);
    updateNodeData(node.id, { rows: nextRows });
    syncPro2FrameImagesFromRows(
      allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
      ),
      node.id,
      nextRows as never,
      updateNodeData,
    );
    if (runtime.status === "done" || runtime.status === "error") {
      const nodesAfter = allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
      );
      reconcilePro2FrameNodesWithColumnRows(
        nodesAfter,
        node.id,
        updateNodeData,
      );
    }
    const pendingSyncGroupId = (
      node.data as { pro2PendingSyncGroupId?: string }
    ).pro2PendingSyncGroupId?.trim();
    if (pendingSyncGroupId) {
      const anyInflight = (nextRows as StoryProFrameRow[]).some(
        (r) =>
          r.runtime?.status === "pending" ||
          r.runtime?.status === "running" ||
          r.runtime?.status === "queued",
      );
      if (!anyInflight) {
        updateNodeData(node.id, {
          pro2PendingSyncGroupId: undefined,
          pro2VisualGroupId: pendingSyncGroupId,
        });
      }
    }
    const starterFrame = findStarterByHubId(
      allNodes,
      (node.data as { hubNodeId?: string }).hubNodeId ?? "",
    );
    const ws = (
      starterFrame?.data as {
        workspaceIds?: {
          characterColumnId: string;
          frameColumnId: string;
          videoColumnId: string;
          scriptHubId: string;
        };
      }
    )?.workspaceIds;
    if (
      ws?.scriptHubId &&
      ws.characterColumnId &&
      ws.frameColumnId &&
      ws.videoColumnId &&
      (runtime.status === "done" || mediaUrl)
    ) {
      const nodesAfter = allNodes.map((n) =>
        n.id === node.id
          ? { ...n, data: { ...n.data, rows: nextRows } }
          : n,
      );
      const downstream = syncDownstreamMediaColumns(
        nodesAfter,
        ws.scriptHubId,
        ws.characterColumnId,
        ws.frameColumnId,
        ws.videoColumnId,
      );
      if (downstream) {
        updateNodeData(ws.videoColumnId, downstream.videoPatch);
        updateNodeData(ws.frameColumnId, downstream.framePatch);
      }
      if (runtime.status === "done") {
        const videoCol = nodesAfter.find((n) => n.id === ws.videoColumnId);
        const videoRows =
          (videoCol?.data as { rows?: StoryProVideoRow[] })?.rows ?? [];
        tryPersistPro2HubMediaFromColumns(
          nodesAfter,
          ws.scriptHubId,
          nextRows as StoryProFrameRow[],
          videoRows,
          updateNodeData,
        );
      }
    }
    if (starterFrame && runtime.status === "done") {
      updateNodeData(starterFrame.id, { pipelineStage: "frames_done" });
    }
    return;
  }

  if (node.type === "story-pro-style") {
    const patch = buildStoryProStyleDraftApplyPatch(task);
    if (patch) updateNodeData(node.id, patch);
    return;
  }

  if (isAnyStoryVideoColumnType(node.type ?? "") && ctx?.rowKey && ctx.mediaKind) {
    const latest = allNodes.find((n) => n.id === node.id) ?? node;
    const rows = (latest.data as { rows: { key: string }[] }).rows ?? [];
    const nextRows = applyVideoRowRuntime(
      rows as never,
      ctx.rowKey,
      ctx.mediaKind === "tts" ? "tts" : "video",
      runtime,
    );
    updateNodeData(node.id, { rows: nextRows });
    syncPro2VideoBoardFromRows(
      allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
      ),
      node.id,
      nextRows as never,
      updateNodeData,
    );
    const hubId = (node.data as { hubNodeId?: string }).hubNodeId?.trim();
    if (hubId && runtime.status === "done") {
      const nodesAfter = allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
      );
      const starterVid = findStarterByHubId(allNodes, hubId);
      const ws = (
        starterVid?.data as {
          workspaceIds?: {
            frameColumnId?: string;
            videoColumnId?: string;
          };
        }
      )?.workspaceIds;
      const frameCol = ws?.frameColumnId
        ? nodesAfter.find((n) => n.id === ws.frameColumnId)
        : undefined;
      const frameRows =
        (frameCol?.data as { rows?: StoryProFrameRow[] })?.rows ?? [];
      tryPersistPro2HubMediaFromColumns(
        nodesAfter,
        hubId,
        frameRows,
        nextRows as StoryProVideoRow[],
        updateNodeData,
      );
    }
    const starterVid = findStarterByHubId(
      allNodes,
      (node.data as { hubNodeId?: string }).hubNodeId ?? "",
    );
    if (starterVid && runtime.status === "done" && ctx.mediaKind === "tts") {
      updateNodeData(starterVid.id, { pipelineStage: "media_done" });
    }
  }
}
