"use client";

import { getBezierPath, Position } from "@xyflow/react";
import { batchConnectSourceClientPoint } from "@/lib/canvas/batch-connect-preview-anchors";
import type { CanvasFlowNode } from "@/lib/canvas/types";

const PREVIEW_STROKE = "#60a5fa";

/** 框选批量拖线 · 贝塞尔预览（全程 document client 坐标） */
export function BatchConnectPreviewLines({
  sources,
  allNodes,
  cursor,
  flowToScreenPosition,
  getInternalNode,
}: {
  sources: CanvasFlowNode[];
  allNodes: CanvasFlowNode[];
  cursor: { x: number; y: number };
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number };
  getInternalNode: (id: string) => unknown;
}) {
  const paths: string[] = [];

  for (const node of sources) {
    const start = batchConnectSourceClientPoint(
      node,
      allNodes,
      flowToScreenPosition,
      getInternalNode,
    );
    if (!start) continue;
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
      !Number.isFinite(cursor.y) ||
      Math.hypot(cursor.x - start.x, cursor.y - start.y) > 720
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
          strokeWidth={2}
        />
      ))}
    </svg>
  );
}
