"use client";

import type { Connection } from "@xyflow/react";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { isRefGridNodeType, refGridSlotCount } from "./ref-video-models";

function hasGridUpstream(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  engineId: string,
  excludeSource?: string,
): boolean {
  for (const e of edges) {
    if (e.target !== engineId) continue;
    if (excludeSource && e.source === excludeSource) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (src && isRefGridNodeType(src.type ?? "")) return true;
  }
  return false;
}

/** 参考生视频连线规则；不合法时返回拒绝原因。 */
export function validateRefVideoConnection(
  connection: Connection,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): { ok: true } | { ok: false; reason: string } {
  const source = nodes.find((n) => n.id === connection.source);
  const target = nodes.find((n) => n.id === connection.target);
  if (!source || !target) return { ok: true };

  const st = source.type ?? "";
  const tt = target.type ?? "";

  if (isRefGridNodeType(st) && isRefGridNodeType(tt)) {
    return { ok: false, reason: "宫格节点之间不可互连" };
  }
  if (isRefGridNodeType(st) && tt === "video-generate") {
    return { ok: false, reason: "宫格须先连接 AI 视频引擎" };
  }
  if (st === "ai-video-engine" && isRefGridNodeType(tt)) {
    return { ok: false, reason: "请从宫格连到引擎（方向：宫格 → 引擎）" };
  }
  if (st === "ai-video-engine" && tt === "ai-video-engine") {
    return { ok: false, reason: "视频引擎之间不可互连" };
  }
  if (isRefGridNodeType(st) && tt === "ai-video-engine") {
    if (
      hasGridUpstream(nodes, edges, target.id, connection.source ?? undefined)
    ) {
      return { ok: false, reason: "该引擎已连接其它宫格" };
    }
  }
  if (tt === "video-generate" && st !== "ai-video-engine") {
    return { ok: false, reason: "视频生成只接受 AI 视频引擎上游" };
  }

  return { ok: true };
}

/** 宫格连到引擎时写入 linkedGridSlotCount。 */
export function applyRefVideoEdgeConnection(args: {
  connection: Connection;
  nodes: CanvasFlowNode[];
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): void {
  const source = args.nodes.find((n) => n.id === args.connection.source);
  const target = args.nodes.find((n) => n.id === args.connection.target);
  if (!source || !target) return;
  if (!isRefGridNodeType(source.type ?? "")) return;
  if (target.type !== "ai-video-engine") return;

  const count = refGridSlotCount(source.type ?? "");
  if (count > 0) {
    args.updateNodeData(target.id, { linkedGridSlotCount: count });
  }
}

export function collectRefImageUrlsFromGridNode(
  node: CanvasFlowNode,
): string[] {
  if (!isRefGridNodeType(node.type ?? "")) return [];
  const slots =
    (node.data as { slots?: { ossUrl?: string }[] }).slots ?? [];
  return slots
    .map((s) => s.ossUrl?.trim())
    .filter((u): u is string => !!u && /^https?:\/\//.test(u));
}
