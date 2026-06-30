import type { CanvasTaskRecord } from "@/lib/canvas-api";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { CanvasNodeRuntime } from "./types";
import { resolveSbv1UpstreamRefLinks } from "./sbv1-upstream-ref-links";
import { pickTaskResultMediaUrl } from "./task-media-url";

const VIDEO_NODE_TYPES = new Set([
  "sbv1-video-engine",
  "video-engine",
  "ai-video-engine",
]);

function posterFromTask(task: Pick<CanvasTaskRecord, "posterUrl"> | undefined): string | undefined {
  const u = task?.posterUrl?.trim();
  return u || undefined;
}

/** 节点 runtime / 最近成功任务 / 上游参考图 · 用作视频封面 */
export function resolveLibtvVideoPosterUrl(args: {
  nodeId: string;
  runtime?: Pick<CanvasNodeRuntime, "posterUrl" | "ossUrl" | "ephemeralUrl">;
  latestSucceededTask?: Pick<CanvasTaskRecord, "posterUrl">;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
}): string | undefined {
  const fromRuntime = args.runtime?.posterUrl?.trim();
  if (fromRuntime) return fromRuntime;

  const fromTask = posterFromTask(args.latestSucceededTask);
  if (fromTask) return fromTask;

  const upstream = resolveSbv1UpstreamRefLinks(args.nodeId, args.nodes, args.edges);
  const refPreview = upstream.find((l) => l.previewUrl?.trim())?.previewUrl?.trim();
  if (refPreview) return refPreview;

  return undefined;
}

export function videoUrlFromNode(node: CanvasFlowNode): string | undefined {
  if (!VIDEO_NODE_TYPES.has(node.type ?? "")) return undefined;
  const d = node.data as {
    runtime?: { ossUrl?: string; ephemeralUrl?: string };
  };
  return (
    d.runtime?.ossUrl?.trim() ||
    d.runtime?.ephemeralUrl?.trim() ||
    undefined
  );
}

export function dialogueFromVideoNode(node: CanvasFlowNode): string | undefined {
  const d = node.data as { prompt?: string };
  const p = d.prompt?.trim();
  return p || undefined;
}

export function videoUrlFromTask(task: Pick<CanvasTaskRecord, "ossUrl" | "ephemeralUrl">): string | undefined {
  return pickTaskResultMediaUrl(task) ?? task.ossUrl?.trim() ?? task.ephemeralUrl?.trim() ?? undefined;
}
