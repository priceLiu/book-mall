"use client";

import type { CSSProperties } from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";

const EDGE_HIT_WIDTH = 40;

function edgeFocusTone(
  style: EdgeProps["style"],
): "up" | "down" | null {
  const stroke = (style as CSSProperties | undefined)?.stroke;
  if (stroke === "#60a5fa") return "up";
  if (stroke === "#238636") return "down";
  return null;
}

/**
 * 可删除连线 · 宽命中带；悬停 1s 出剪刀由 FlowCanvas · useCanvasEdgeCutHover 统一处理。
 * 选中节点高亮时叠加扫光层（沿路径流动的光带）。
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

  const focusTone = edgeFocusTone(style);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={EDGE_HIT_WIDTH}
        className="deletable-edge"
      />
      {focusTone ? (
        <path
          d={edgePath}
          fill="none"
          pointerEvents="none"
          className={`react-flow__edge-path pro2-edge-sweep-overlay pro2-edge-sweep-${focusTone}`}
        />
      ) : null}
    </>
  );
}
