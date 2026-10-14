import type { CanvasTaskRecord } from "@/lib/canvas-api";
import { directPredecessors } from "./topo";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  dedupeSucceededImageGenerationsByMedia,
  libtvPinnedImageTaskId,
  listSucceededImageGenerations,
  type LibtvActiveImageTaskFields,
} from "./libtv-image-generation-stack";
import { isLibtvFreestandingImageNode } from "./libtv-image-node-run";
import { pickPro2DockNodePreviewUrl } from "./pro2-dock-upstream-links";
import { pickTaskImagePreviewUrl } from "./task-media-url";
import { storyRefIdsFromPrompt } from "./story-ref-image";

export type LibtvUsedImageTaskFields = LibtvActiveImageTaskFields & {
  usedImageTaskIds?: string[];
};

const LIBTV_IMAGE_STACK_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
]);

export function isLibtvImageGenerationStackNode(
  node: Pick<CanvasFlowNode, "type" | "data"> | undefined,
): boolean {
  if (!node?.type) return false;
  if (!LIBTV_IMAGE_STACK_TYPES.has(node.type)) return false;
  return isLibtvFreestandingImageNode(node);
}

export function normalizeLibtvMediaUrl(url: string | undefined | null): string {
  const raw = url?.trim() ?? "";
  if (!raw) return "";
  try {
    const u = new URL(raw);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return raw.split("?")[0]?.split("#")[0] ?? raw;
  }
}

export function appendUsedImageTaskIds(
  existing: string[] | undefined,
  taskId: string | undefined,
): string[] {
  const id = taskId?.trim();
  if (!id) return existing?.length ? [...existing] : [];
  const set = new Set((existing ?? []).map((x) => x.trim()).filter(Boolean));
  set.add(id);
  return [...set];
}

export function usedImageTaskIdsPatch(
  data: LibtvUsedImageTaskFields,
  taskId: string | undefined,
): { usedImageTaskIds: string[] } | null {
  const next = appendUsedImageTaskIds(data.usedImageTaskIds, taskId);
  const prev = data.usedImageTaskIds ?? [];
  if (
    next.length === prev.length &&
    next.every((id, i) => id === prev[i])
  ) {
    return null;
  }
  return { usedImageTaskIds: next };
}

export function resolveTaskIdForMediaUrl(
  data: LibtvUsedImageTaskFields,
  history: CanvasTaskRecord[],
  mediaUrl: string,
): string | undefined {
  const norm = normalizeLibtvMediaUrl(mediaUrl);
  if (!norm) return libtvPinnedImageTaskId(data);
  const succeeded = listSucceededImageGenerations(history);
  for (let i = succeeded.length - 1; i >= 0; i -= 1) {
    const t = succeeded[i]!;
    if (normalizeLibtvMediaUrl(pickTaskImagePreviewUrl(t)) === norm) {
      return t.id;
    }
  }
  return libtvPinnedImageTaskId(data);
}

function consumerHasSucceededTask(
  consumerNodeId: string,
  history: CanvasTaskRecord[],
): boolean {
  return history.some(
    (t) => t.nodeId === consumerNodeId && t.status === "SUCCEEDED",
  );
}

function nodeReferencesSourceImage(
  consumer: CanvasFlowNode,
  sourceNodeId: string,
  mediaUrl: string,
): boolean {
  const norm = normalizeLibtvMediaUrl(mediaUrl);
  const d = consumer.data as {
    dockInput?: string;
    dockRefImages?: { id?: string; url?: string }[];
  };
  for (const ref of d.dockRefImages ?? []) {
    if (normalizeLibtvMediaUrl(ref.url) === norm) return true;
    if (ref.id?.includes(sourceNodeId)) return true;
  }
  const prompt = d.dockInput ?? "";
  if (prompt.includes(sourceNodeId)) return true;
  for (const refId of storyRefIdsFromPrompt(prompt)) {
    if (refId.includes(sourceNodeId) || refId === `up-image-${sourceNodeId}`) {
      return true;
    }
  }
  return false;
}

/** 图是否已被下游成功任务或 @/参考图消费（含 persisted usedImageTaskIds） */
export function collectLibtvUsedImageTaskIds(args: {
  nodeId: string;
  nodeData: LibtvUsedImageTaskFields;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  history: CanvasTaskRecord[];
}): Set<string> {
  const { nodeId, nodeData, nodes, edges, history } = args;
  const used = new Set<string>(
    (nodeData.usedImageTaskIds ?? []).map((x) => x.trim()).filter(Boolean),
  );
  const succeeded = listSucceededImageGenerations(history);

  for (const task of succeeded) {
    if (used.has(task.id)) continue;
    const url = pickTaskImagePreviewUrl(task)?.trim();
    if (!url) continue;
    if (
      isLibtvImageMediaConsumedInGraph({
        sourceNodeId: nodeId,
        mediaUrl: url,
        nodes,
        edges,
        history,
      })
    ) {
      used.add(task.id);
    }
  }
  return used;
}

export function isLibtvImageMediaConsumedInGraph(args: {
  sourceNodeId: string;
  mediaUrl: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  history: CanvasTaskRecord[];
}): boolean {
  const { sourceNodeId, mediaUrl, nodes, edges, history } = args;
  const sourceNorm = normalizeLibtvMediaUrl(mediaUrl);

  const source = nodes.find((n) => n.id === sourceNodeId);
  const liveUrl = source
    ? normalizeLibtvMediaUrl(pickPro2DockNodePreviewUrl(source))
    : "";

  for (const e of edges) {
    if (e.source !== sourceNodeId) continue;
    const targetId = e.target;
    if (!consumerHasSucceededTask(targetId, history)) continue;
    const consumer = nodes.find((n) => n.id === targetId);
    if (consumer && nodeReferencesSourceImage(consumer, sourceNodeId, mediaUrl)) {
      return true;
    }
    if (liveUrl && liveUrl === sourceNorm) return true;
  }

  for (const consumer of nodes) {
    if (consumer.id === sourceNodeId) continue;
    if (!consumerHasSucceededTask(consumer.id, history)) continue;
    if (nodeReferencesSourceImage(consumer, sourceNodeId, mediaUrl)) {
      return true;
    }
  }

  return false;
}

/** 下游任务成功 · 标记上游图片节点当前成片 task 为已用过 */
export function markLibtvUpstreamImagesUsedWhenConsumerSucceeded(
  consumerNodeId: string,
  task: CanvasTaskRecord,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  history: CanvasTaskRecord[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): void {
  if (task.status !== "SUCCEEDED" || task.nodeId !== consumerNodeId) return;

  const markSourceNode = (sourceNodeId: string) => {
    const source = nodes.find((n) => n.id === sourceNodeId);
    if (!source || !isLibtvImageGenerationStackNode(source)) return;
    const data = source.data as LibtvUsedImageTaskFields;
    const url = pickPro2DockNodePreviewUrl(source)?.trim();
    const taskId = resolveTaskIdForMediaUrl(
      data,
      history.filter((t) => t.nodeId === sourceNodeId),
      url ?? "",
    );
    const patch = usedImageTaskIdsPatch(data, taskId);
    if (patch) updateNodeData(sourceNodeId, patch);
  };

  for (const pid of directPredecessors(edges, consumerNodeId)) {
    markSourceNode(pid);
  }

  const consumer = nodes.find((n) => n.id === consumerNodeId);
  if (!consumer) return;

  for (const n of nodes) {
    if (!isLibtvImageGenerationStackNode(n)) continue;
    const preview = pickPro2DockNodePreviewUrl(n)?.trim();
    if (!preview) continue;
    if (nodeReferencesSourceImage(consumer, n.id, preview)) {
      markSourceNode(n.id);
    }
  }
}

export function markLibtvImageNodeTaskUsed(
  nodeId: string,
  taskId: string | undefined,
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  nodeData?: LibtvUsedImageTaskFields,
): void {
  const patch = usedImageTaskIdsPatch(nodeData ?? {}, taskId);
  if (patch) updateNodeData(nodeId, patch);
}

/** 魔法编辑 / 应用产生新 task 前 · 标记被当作输入的版本 */
export function usedImageTaskIdsAfterMagicApply(
  prev: LibtvUsedImageTaskFields & Record<string, unknown>,
): string[] {
  const hadMagic =
    Boolean(prev.libtvInpaintSession) ||
    Boolean(prev.libtvEraseSession) ||
    Boolean(prev.libtvCropSession) ||
    Boolean(prev.libtvExpandSession);
  if (!hadMagic) return prev.usedImageTaskIds ?? [];
  const prior = libtvPinnedImageTaskId(prev);
  return appendUsedImageTaskIds(prev.usedImageTaskIds, prior);
}
