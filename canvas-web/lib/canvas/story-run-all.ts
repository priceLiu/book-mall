"use client";

import type { CanvasStoryRunJob } from "./canvas-run-bus";
import { hubSectionNeedsRun } from "./story-hub-runtime";
import {
  findStoryWorkspaceForStarter,
  STORY_HUB_SECTION_ORDER,
} from "./spawn-story-workspace";
import type {
  StoryCharacterColumnNodeData,
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
  StoryWorkspaceIds,
} from "./story-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

function rowNeedsMedia(
  runtime: { status?: string; ossUrl?: string; ephemeralUrl?: string } | undefined,
): boolean {
  const st = runtime?.status ?? "idle";
  if (st === "running" || st === "queued") return false;
  if (runtime?.ossUrl || runtime?.ephemeralUrl) return false;
  return st === "idle" || st === "error";
}

function collectJobsForWorkspace(
  nodes: CanvasFlowNode[],
  ws: StoryWorkspaceIds,
): CanvasStoryRunJob[] {
  const jobs: CanvasStoryRunJob[] = [];
  const hub = nodes.find((n) => n.id === ws.scriptHubId);
  if (!hub) return jobs;

  for (const section of STORY_HUB_SECTION_ORDER) {
    if (hubSectionNeedsRun(hub, section, false)) {
      jobs.push({ nodeId: hub.id, llmSection: section });
    }
  }

  const charCol = ws.characterColumnId
    ? nodes.find((n) => n.id === ws.characterColumnId)
    : undefined;
  if (charCol) {
    const d = charCol.data as unknown as StoryCharacterColumnNodeData;
    if (d.batchImage?.providerId) {
      for (const r of d.rows ?? []) {
        if (rowNeedsMedia(r.runtime)) {
          jobs.push({
            nodeId: charCol.id,
            rowKey: r.key,
            mediaKind: "threeView",
          });
        }
      }
    }
  }

  const frameCol = ws.frameColumnId
    ? nodes.find((n) => n.id === ws.frameColumnId)
    : undefined;
  if (frameCol) {
    const d = frameCol.data as unknown as StoryFrameColumnNodeData;
    if (d.batchImage?.providerId) {
      for (const r of d.rows ?? []) {
        if (rowNeedsMedia(r.runtime)) {
          jobs.push({
            nodeId: frameCol.id,
            rowKey: r.key,
            mediaKind: "frameImage",
          });
        }
      }
    }
  }

  const videoCol = ws.videoColumnId
    ? nodes.find((n) => n.id === ws.videoColumnId)
    : undefined;
  const frameBatch =
    (frameCol?.data as StoryFrameColumnNodeData)?.batchVideo ??
    (frameCol?.data as StoryFrameColumnNodeData)?.batchImage;
  const videoBatch =
    (videoCol?.data as StoryVideoColumnNodeData)?.batchVideo ?? frameBatch;

  if (videoCol && videoBatch?.providerId) {
    const d = videoCol.data as unknown as StoryVideoColumnNodeData;
    for (const r of d.rows ?? []) {
      if (rowNeedsMedia(r.videoRuntime)) {
        jobs.push({
          nodeId: videoCol.id,
          rowKey: r.key,
          mediaKind: "video",
        });
      }
    }
  }

  return jobs;
}

/** 四节点工作区 · 收集「全部运行」任务（hub 段 + 列行，按拓扑顺序）。 */
export function collectStoryWorkspaceRunJobs(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[] = [],
): CanvasStoryRunJob[] {
  const jobs: CanvasStoryRunJob[] = [];
  const seenHub = new Set<string>();

  for (const starter of nodes.filter((n) => n.type === "story-comic-starter")) {
    const stored = (starter.data as { workspaceIds?: StoryWorkspaceIds })
      .workspaceIds;
    const ws = findStoryWorkspaceForStarter(
      nodes,
      edges,
      starter.id,
      stored,
    );
    if (!ws?.scriptHubId || seenHub.has(ws.scriptHubId)) continue;
    seenHub.add(ws.scriptHubId);
    jobs.push(...collectJobsForWorkspace(nodes, ws));
  }

  return jobs;
}
