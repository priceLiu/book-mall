"use client";

import type { Connection } from "@xyflow/react";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const STYLE_ASSET_TYPE = "story-pro2-style-asset";

const STYLE_ASSET_CONNECT_TARGETS = new Set([
  "story-pro2-script-hub",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-starter",
  "sbv1-image",
]);

const IMAGE_STYLE_LINK_TARGETS = new Set([
  "story-pro2-image",
  "story-pro2-three-view",
  "sbv1-image",
]);

/** 风格素材节点可连出的目标类型 */
export function isPro2StyleAssetConnectTarget(
  nodeType: string | undefined,
): boolean {
  return Boolean(nodeType && STYLE_ASSET_CONNECT_TARGETS.has(nodeType));
}

export function validatePro2StyleAssetConnection(
  connection: Connection,
  nodes: CanvasFlowNode[],
): { ok: true } | { ok: false; reason: string } {
  const source = nodes.find((n) => n.id === connection.source);
  const target = nodes.find((n) => n.id === connection.target);
  if (!source || !target) return { ok: true };

  const st = source.type ?? "";
  const tt = target.type ?? "";

  if (st === STYLE_ASSET_TYPE) {
    if (!isPro2StyleAssetConnectTarget(tt)) {
      return {
        ok: false,
        reason: "风格节点仅可连接脚本、文本、图片或三视图节点",
      };
    }
    return { ok: true };
  }

  if (tt === STYLE_ASSET_TYPE) {
    return {
      ok: false,
      reason: "请从风格节点拖出连线到脚本、图片或三视图节点",
    };
  }

  return { ok: true };
}

const SNAP_MAX_PX = 480;

/** 生成风格节点后自动吸附最近/选中的脚本节点 */
export function findPro2StyleAssetSnapScriptHub(
  nodes: CanvasFlowNode[],
  stylePosition: { x: number; y: number },
): CanvasFlowNode | undefined {
  const selected = nodes.find(
    (n) => n.selected && n.type === "story-pro2-script-hub",
  );
  if (selected) return selected;

  let best: CanvasFlowNode | undefined;
  let bestDist = SNAP_MAX_PX;
  for (const hub of nodes) {
    if (hub.type !== "story-pro2-script-hub") continue;
    const dx = (hub.position?.x ?? 0) - stylePosition.x;
    const dy = (hub.position?.y ?? 0) - stylePosition.y;
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      best = hub;
    }
  }
  return best;
}

export function buildPro2StyleAssetToHubEdge(
  styleNodeId: string,
  hubId: string,
): CanvasFlowEdge {
  return {
    id: `e-style-${styleNodeId}-${hubId}`,
    source: styleNodeId,
    target: hubId,
    sourceHandle: "style",
    targetHandle: "in_text",
  };
}

export function buildPro2StyleAssetToImageEdge(
  styleNodeId: string,
  imageNodeId: string,
): CanvasFlowEdge {
  return {
    id: `e-style-${styleNodeId}-${imageNodeId}`,
    source: styleNodeId,
    target: imageNodeId,
    sourceHandle: "style",
    targetHandle: "in_image",
  };
}

/** 图片节点左侧已连的风格素材（Dock 风格库选中后复用更新） */
export function findStyleAssetLinkedToImage(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  imageNodeId: string,
): CanvasFlowNode | undefined {
  for (const e of edges) {
    if (e.target !== imageNodeId) continue;
    if (e.targetHandle && e.targetHandle !== "in_image") continue;
    const source = nodes.find((n) => n.id === e.source);
    if (
      source?.type === STYLE_ASSET_TYPE &&
      IMAGE_STYLE_LINK_TARGETS.has(
        nodes.find((n) => n.id === imageNodeId)?.type ?? "",
      )
    ) {
      return source;
    }
  }
  return undefined;
}
