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
import { hubSectionIsReady, hubSectionRuntime } from "./story-hub-runtime";
import { isCanvasInflightStatus } from "./story-column-runtime";
import type {
  StoryLlmSection,
  StoryRunContext,
  StoryScriptHubNodeData,
} from "./story-workspace-types";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { formatCanvasTaskError } from "./friendly-task-error";
import { applyScriptStudioThemeOutlineResult } from "./script-studio-run-apply";
import { pickTaskResultMediaUrl } from "./task-media-url";
import { shouldSkipStoryRowTaskApply } from "./task-pick";
import { buildStoryProStyleDraftApplyPatch } from "./story-pro-style-draft";
import { syncPro2CharacterImagesFromRows } from "./pro2-spawn-character-image-group";
import { syncPro2FrameImagesFromRows } from "./pro2-spawn-frame-image-group";
import { syncPro2VideoBoardFromRows } from "./pro2-spawn-video-board-group";
import { syncPro2SceneImagesFromRows } from "./pro2-spawn-scene-image-group";
import { isPro2StoryOutlineTextNode } from "./pro2-text-purpose";
import type { StoryProFrameRow, StoryProSceneRow } from "./story-pro-workspace-types";
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
    (node.type === "story-pro2-starter" || node.type === "story-pro-starter") &&
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

  if (
    (node.type === "story-pro2-starter" ||
      node.type === "story-pro-starter" ||
      node.type === "story-pro2-script-hub") &&
    ctx?.mediaKind === "themeOutline"
  ) {
    const hubStudio =
      node.type === "story-pro2-script-hub" &&
      (node.data as { scriptStudioMode?: boolean }).scriptStudioMode === true;
    if (
      node.type === "story-pro2-starter" &&
      !isPro2StoryOutlineTextNode((node.data ?? {}) as Record<string, unknown>)
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
      if (node.type === "story-pro2-starter") {
        patch.generatedOutlineMd = task.textOutput.trim();
        patch.pipelineStage = "llm_done";
        patch.starterMode = "generate";
      }
    }
    updateNodeData(node.id, patch);
    if (task.status === "SUCCEEDED" && task.textOutput?.trim()) {
      applyScriptStudioThemeOutlineResult(
        node,
        task.textOutput.trim(),
        allNodes,
        updateNodeData,
      );
    }
    return;
  }

  if (
    (node.type === "story-pro2-starter" || node.type === "story-pro-starter") &&
    ctx?.mediaKind === "generalText"
  ) {
    if (
      node.type === "story-pro2-starter" &&
      isPro2StoryOutlineTextNode((node.data ?? {}) as Record<string, unknown>)
    ) {
      return;
    }
    const prevRt = (
      node.data as { themeOutlineRuntime?: CanvasNodeRuntime }
    ).themeOutlineRuntime;
    if (shouldSkipStoryRowTaskApply(prevRt, task, node.id)) return;
    const patch: Record<string, unknown> = { themeOutlineRuntime: runtime };
    if (task.status === "SUCCEEDED" && task.textOutput?.trim()) {
      patch.generatedOutlineMd = task.textOutput.trim();
    }
    updateNodeData(node.id, patch);
    return;
  }

  if (isAnyStoryScriptHubType(node.type ?? "") && ctx?.llmSection) {
    if (
      (task.status === "SUBMITTED" || task.status === "PENDING") &&
      hubSectionIsReady(node, ctx.llmSection) &&
      !isCanvasInflightStatus(hubSectionRuntime(node, ctx.llmSection)?.status)
    ) {
      return;
    }
    const prev = node.data as unknown as StoryScriptHubNodeData;
    const patch = applyHubSectionFromTask(
      prev,
      ctx.llmSection,
      runtime,
      task.textOutput ?? undefined,
    );
    if (!hubSectionPatchChanged(prev, ctx.llmSection, patch)) return;
    updateNodeData(node.id, patch);
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
      if (
        ws.characterColumnId &&
        ws.frameColumnId &&
        ws.videoColumnId
      ) {
        const synced = syncColumnsFromHub(
          allNodes.map((n) =>
            n.id === node.id ? { ...n, data: { ...n.data, ...patch } } : n,
          ),
          node.id,
          ws.characterColumnId,
          ws.frameColumnId,
          ws.videoColumnId,
        );
        if (synced) {
          updateNodeData(ws.characterColumnId, synced.characterPatch);
          updateNodeData(ws.frameColumnId, synced.framePatch);
          updateNodeData(ws.videoColumnId, synced.videoPatch);
        }
      }
      if (starter && starter.data) {
        const stage = (starter.data as { pipelineStage?: string }).pipelineStage;
        if (stage === "finalized") {
          /* 已定稿后不再改阶段 */
        } else if (ctx.llmSection === "storyboard") {
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
    syncPro2CharacterImagesFromRows(
      allNodes.map((n) =>
        n.id === node.id ? { ...n, data: { ...n.data, rows: nextRows } } : n,
      ),
      node.id,
      nextRows as never,
      updateNodeData,
    );
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
    const pendingSyncGroupId = (
      node.data as { pro2PendingSyncGroupId?: string }
    ).pro2PendingSyncGroupId?.trim();
    if (pendingSyncGroupId) {
      const anyInflight = (nextRows as StoryProFrameRow[]).some(
        (r) =>
          r.runtime?.status === "pending" || r.runtime?.status === "running",
      );
      if (!anyInflight) {
        updateNodeData(node.id, { pro2PendingSyncGroupId: undefined });
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
    const starterVid = findStarterByHubId(
      allNodes,
      (node.data as { hubNodeId?: string }).hubNodeId ?? "",
    );
    if (starterVid && runtime.status === "done" && ctx.mediaKind === "tts") {
      updateNodeData(starterVid.id, { pipelineStage: "media_done" });
    }
  }
}
