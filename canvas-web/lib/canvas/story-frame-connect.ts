"use client";

import type { Connection, Edge } from "@xyflow/react";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { ImageEngineNodeData, StoryEngineNodeData } from "./types";
import {
  STORY_VIDEO_ENGINE_PROMPT_DEFAULT,
} from "./story-prompts";
import { parseStoryboardRows } from "./parse-md-tables";
import { findStoryboardEngineForNode } from "./story-batch-spawn";

function edgeExists(
  edges: CanvasFlowEdge[],
  source: string,
  target: string,
  sourceHandle?: string | null,
): boolean {
  return edges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      (sourceHandle == null || e.sourceHandle === sourceHandle),
  );
}

function addEdgeIfMissing(
  edges: CanvasFlowEdge[],
  edge: Edge,
): CanvasFlowEdge[] {
  if (edgeExists(edges, edge.source, edge.target, edge.sourceHandle)) {
    return edges;
  }
  return [...edges, edge as CanvasFlowEdge];
}

type FrameMediaLink = {
  frameNode: CanvasFlowNode;
  mediaNode: CanvasFlowNode;
  mediaType: "video" | "tts";
};

function resolveFrameMediaLink(
  connection: Connection,
  nodes: CanvasFlowNode[],
): FrameMediaLink | null {
  const source = nodes.find((n) => n.id === connection.source);
  const target = nodes.find((n) => n.id === connection.target);
  if (!source || !target) return null;

  const isFrame = (n: CanvasFlowNode) =>
    n.type === "image-engine" &&
    (n.data as ImageEngineNodeData).frameIndex != null;

  if (isFrame(source)) {
    if (target.type === "video-engine") {
      return { frameNode: source, mediaNode: target, mediaType: "video" };
    }
    if (target.type === "tts-engine") {
      return { frameNode: source, mediaNode: target, mediaType: "tts" };
    }
  }
  if (isFrame(target)) {
    if (source.type === "video-engine") {
      return { frameNode: target, mediaNode: source, mediaType: "video" };
    }
    if (source.type === "tts-engine") {
      return { frameNode: target, mediaNode: source, mediaType: "tts" };
    }
  }
  return null;
}

/**
 * 分镜图节点连到视频/语音时：写入镜号、提示词/对白，并补 storyboard → 媒体 文本边。
 */
export function applyStoryFrameEdgeConnection(args: {
  connection: Connection;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): CanvasFlowEdge[] {
  const link = resolveFrameMediaLink(args.connection, args.nodes);
  if (!link) return args.edges;

  const frameIndex = (link.frameNode.data as ImageEngineNodeData).frameIndex;
  if (frameIndex == null) return args.edges;

  const sb = findStoryboardEngineForNode(
    args.nodes,
    args.edges,
    link.frameNode.id,
  );
  const md =
    (sb?.data as StoryEngineNodeData)?.runtime?.textOutput ?? "";
  const imgData = link.frameNode.data as ImageEngineNodeData;
  const row = parseStoryboardRows(md).find((r) => r.frameIndex === frameIndex);
  const sbData = sb?.data as StoryEngineNodeData | undefined;

  let nextEdges = args.edges;

  if (link.mediaType === "video") {
    const prompt =
      imgData.frameVideoPrompt?.trim() ||
      row?.videoPrompt?.trim() ||
      STORY_VIDEO_ENGINE_PROMPT_DEFAULT;
    const patch: Record<string, unknown> = {
      frameIndex,
      prompt,
    };
    const videoPick = imgData.frameVideo ?? sbData?.batchVideo;
    if (videoPick?.providerId && videoPick.modelKey) {
      patch.providerId = videoPick.providerId;
      patch.modelKey = videoPick.modelKey;
      patch.params = videoPick.params ?? {};
    }
    args.updateNodeData(link.mediaNode.id, patch);
    if (sb) {
      nextEdges = addEdgeIfMissing(nextEdges, {
        id: `e_sb_vid_${link.mediaNode.id}`,
        source: sb.id,
        target: link.mediaNode.id,
        sourceHandle: "text",
        targetHandle: "in_text",
      });
    }
  }

  if (link.mediaType === "tts") {
    const raw =
      imgData.frameDialogue?.trim() || (row?.dialogue ?? "").trim();
    const patch: Record<string, unknown> = {
      frameIndex,
      ...(raw && raw !== "—" && raw !== "-" ? { text: raw } : {}),
    };
    const ttsPick = imgData.frameTts ?? sbData?.batchTts;
    if (ttsPick?.providerId && ttsPick.modelKey) {
      patch.providerId = ttsPick.providerId;
      patch.modelKey = ttsPick.modelKey;
      patch.params = ttsPick.params ?? {};
    }
    args.updateNodeData(link.mediaNode.id, patch);
    if (sb) {
      nextEdges = addEdgeIfMissing(nextEdges, {
        id: `e_sb_tts_${link.mediaNode.id}`,
        source: sb.id,
        target: link.mediaNode.id,
        sourceHandle: "text",
        targetHandle: "in_text",
      });
    }
  }

  return nextEdges;
}
