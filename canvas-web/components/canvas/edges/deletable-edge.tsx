"use client";

import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

const EDGE_HIT_WIDTH = 40;

/**
 * 可删除连线 · 宽命中带；悬停 1s 出剪刀由 FlowCanvas · useCanvasEdgeCutHover 统一处理。
 */
export function DeletableEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
  } = props;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={style}
      interactionWidth={EDGE_HIT_WIDTH}
      className="deletable-edge"
    />
  );
}
