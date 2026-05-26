"use client";

import type { CanvasTaskRecord } from "@/lib/canvas-api";
import {
  applyCharacterRowRuntime,
  applyFrameRowRuntime,
  applyHubSectionFromTask,
  applyVideoRowRuntime,
} from "./story-row-patch";
import {
  syncColumnsFromHub,
  syncDownstreamMediaColumns,
} from "./story-column-sync";
import { hubSectionIsReady } from "./story-hub-runtime";
import type {
  StoryLlmSection,
  StoryRunContext,
  StoryScriptHubNodeData,
} from "./story-workspace-types";
import type { CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { pickTaskResultMediaUrl } from "./task-media-url";

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
        : "storyboardRuntime";
  const mdKey =
    section === "outline"
      ? "outlineMd"
      : section === "character"
        ? "characterMd"
        : "storyboardMd";
  const prevRt = prev[rtKey as keyof StoryScriptHubNodeData];
  const nextRt = patch[rtKey as keyof StoryScriptHubNodeData];
  const prevMd = prev[mdKey as keyof StoryScriptHubNodeData];
  const nextMd = patch[mdKey as keyof StoryScriptHubNodeData];
  if (JSON.stringify(prevRt) !== JSON.stringify(nextRt)) return true;
  if (typeof nextMd === "string" && nextMd !== prevMd) return true;
  return false;
}

export function storyRunPendingPatch(
  node: CanvasFlowNode,
  ctx?: StoryRunContext,
): Record<string, unknown> | null {
  if (node.type === "story-script-hub" && ctx?.llmSection) {
    const rt: CanvasNodeRuntime = {
      status: "pending",
      failCode: undefined,
      failMessage: undefined,
    };
    if (ctx.llmSection === "outline") return { outlineRuntime: rt };
    if (ctx.llmSection === "character") return { characterRuntime: rt };
    return { storyboardRuntime: rt };
  }
  if (
    (node.type === "story-character-column" ||
      node.type === "story-frame-column") &&
    ctx?.rowKey
  ) {
    const rows = (node.data as { rows?: { key: string; runtime?: CanvasNodeRuntime }[] })
      .rows;
    if (!rows) return null;
    if (node.type === "story-character-column") {
      return {
        rows: applyCharacterRowRuntime(rows as never, ctx.rowKey, {
          status: "pending",
        }),
      };
    }
    return {
      rows: applyFrameRowRuntime(rows as never, ctx.rowKey, { status: "pending" }),
    };
  }
  if (node.type === "story-video-column" && ctx?.rowKey && ctx.mediaKind) {
    const rows = (node.data as { rows?: { key: string }[] }).rows;
    if (!rows) return null;
    return {
      rows: applyVideoRowRuntime(
        rows as never,
        ctx.rowKey,
        ctx.mediaKind === "tts" ? "tts" : "video",
        { status: "pending" },
      ),
    };
  }
  return null;
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
        }
      : task.status === "FAILED"
        ? {
            status: "error",
            taskId: task.id,
            failCode: task.failCode ?? "FAILED",
            failMessage: task.failMessage ?? undefined,
          }
        : task.status === "SUBMITTED"
          ? { status: "running", taskId: task.id }
          : { status: "pending", taskId: task.id };

  if (node.type === "story-script-hub" && ctx?.llmSection) {
    if (
      (task.status === "SUBMITTED" || task.status === "PENDING") &&
      hubSectionIsReady(node, ctx.llmSection)
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
    const starter = allNodes.find((n) => n.type === "story-comic-starter");
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

  if (node.type === "story-character-column" && ctx?.rowKey) {
    const rows = (node.data as { rows: { key: string }[] }).rows ?? [];
    const nextRows = applyCharacterRowRuntime(
      rows as never,
      ctx.rowKey,
      runtime,
    );
    updateNodeData(node.id, { rows: nextRows });
    const starter = allNodes.find((n) => n.type === "story-comic-starter");
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

  if (node.type === "story-frame-column" && ctx?.rowKey) {
    const rows = (node.data as { rows: { key: string }[] }).rows ?? [];
    const nextRows = applyFrameRowRuntime(rows as never, ctx.rowKey, runtime);
    updateNodeData(node.id, { rows: nextRows });
    const starterFrame = allNodes.find((n) => n.type === "story-comic-starter");
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

  if (node.type === "story-video-column" && ctx?.rowKey && ctx.mediaKind) {
    const rows = (node.data as { rows: { key: string }[] }).rows ?? [];
    updateNodeData(node.id, {
      rows: applyVideoRowRuntime(
        rows as never,
        ctx.rowKey,
        ctx.mediaKind === "tts" ? "tts" : "video",
        runtime,
      ),
    });
    const starterVid = allNodes.find((n) => n.type === "story-comic-starter");
    if (starterVid && runtime.status === "done" && ctx.mediaKind === "tts") {
      updateNodeData(starterVid.id, { pipelineStage: "media_done" });
    }
  }
}
