"use client";

import { getBezierPath, Position } from "@xyflow/react";
import { batchConnectSourceClientPoint } from "@/lib/canvas/batch-connect-preview-anchors";
import { CANVAS_EDGE_STROKE_WIDTH_CONNECTING } from "@/lib/canvas/canvas-edge-layer-z";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const PREVIEW_STROKE = "#60a5fa";

/** 框选批量拖线 · 贝塞尔预览（全程 document client 坐标） */
export function BatchConnectPreviewLines({
  sources,
  allNodes,
  cursor,
  flowToScreenPosition,
  getInternalNode,
  /** 拖线开始时缓存的源点，避免 pointermove 每帧 querySelector */
  sourcePoints,
}: {
  sources: CanvasFlowNode[];
  allNodes: CanvasFlowNode[];
  cursor: { x: number; y: number };
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number };
  getInternalNode: (id: string) => unknown;
  sourcePoints?: { x: number; y: number }[];
}) {
  const paths: string[] = [];

  const starts =
    sourcePoints ??
    sources
      .map((node) =>
        batchConnectSourceClientPoint(
          node,
          allNodes,
          flowToScreenPosition,
          getInternalNode,
        ),
      )
      .filter((p): p is { x: number; y: number } => p != null);

  for (const start of starts) {
    if (
      !Number.isFinite(start.x) ||
      !Number.isFinite(start.y) ||
      start.x < -64 ||
      start.y < -64 ||
      start.x > window.innerWidth + 64 ||
      start.y > window.innerHeight + 64
    ) {
      continue;
    }
    if (
      !Number.isFinite(cursor.x) ||
      !Number.isFinite(cursor.y)
    ) {
      continue;
    }
    const [path] = getBezierPath({
      sourceX: start.x,
      sourceY: start.y,
      sourcePosition: Position.Right,
      targetX: cursor.x,
      targetY: cursor.y,
      targetPosition: Position.Left,
    });
    paths.push(path);
  }

  if (!paths.length) return null;

  return (
    <svg
      className="pointer-events-none fixed inset-0 z-[2100]"
      width="100%"
      height="100%"
      aria-hidden
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={PREVIEW_STROKE}
          strokeWidth={CANVAS_EDGE_STROKE_WIDTH_CONNECTING}
        />
      ))}
    </svg>
  );
}
