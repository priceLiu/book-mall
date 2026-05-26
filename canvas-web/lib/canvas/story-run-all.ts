"use client";

import type { CanvasStoryRunJob } from "./canvas-run-bus";
import { hubSectionNeedsRun } from "./story-hub-runtime";
import { STORY_HUB_SECTION_ORDER } from "./spawn-story-workspace";
import type {
  StoryCharacterColumnNodeData,
  StoryFrameColumnNodeData,
  StoryVideoColumnNodeData,
} from "./story-workspace-types";
import type { CanvasFlowNode } from "./types";

function rowNeedsMedia(
  runtime: { status?: string; ossUrl?: string; ephemeralUrl?: string } | undefined,
): boolean {
  const st = runtime?.status ?? "idle";
  if (st === "running" || st === "queued") return false;
  if (runtime?.ossUrl || runtime?.ephemeralUrl) return false;
  return st === "idle" || st === "error";
}

/** 四节点工作区 · 收集「全部运行」任务（hub 段 + 列行，按拓扑顺序）。 */
export function collectStoryWorkspaceRunJobs(
  nodes: CanvasFlowNode[],
): CanvasStoryRunJob[] {
  const jobs: CanvasStoryRunJob[] = [];
  const hub = nodes.find((n) => n.type === "story-script-hub");
  if (!hub) return jobs;

  for (const section of STORY_HUB_SECTION_ORDER) {
    if (hubSectionNeedsRun(hub, section, false)) {
      jobs.push({ nodeId: hub.id, llmSection: section });
    }
  }

  const charCol = nodes.find((n) => n.type === "story-character-column");
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

  const frameCol = nodes.find((n) => n.type === "story-frame-column");
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

  const videoCol = nodes.find((n) => n.type === "story-video-column");
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
