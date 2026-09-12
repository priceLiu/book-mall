"use client";

import type { CSSProperties } from "react";
import {
  BaseEdge,
  getBezierPath,
  type EdgeProps,
} from "@xyflow/react";
import {
  CANVAS_EDGE_STROKE_WIDTH,
  CANVAS_EDGE_STROKE_WIDTH_ACTIVE,
} from "@/lib/canvas/canvas-edge-layer-z";
import {
  resolveCanvasEdgeFocusTone,
  useCanvasEdgeFocus,
} from "./canvas-edge-focus-context";

const EDGE_HIT_WIDTH = 40;

const FOCUS_STROKE_UP = "#60a5fa";
const FOCUS_STROKE_DOWN = "#238636";

/**
 * 可删除连线 · 宽命中带；悬停 1s 出剪刀由 FlowCanvas · useCanvasEdgeCutHover 统一处理。
 * 选中节点高亮时叠加扫光层（沿路径流动的光带）。
 */
export function DeletableEdge(props: EdgeProps) {
  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
  } = props;

  const { focusNodeIds } = useCanvasEdgeFocus();

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const focusTone = resolveCanvasEdgeFocusTone(
    String(source),
    String(target),
    focusNodeIds,
  );
  const baseStyle = (style ?? {}) as CSSProperties;
  const edgeStyle: CSSProperties = focusTone
    ? {
        ...baseStyle,
        stroke: focusTone === "up" ? FOCUS_STROKE_UP : FOCUS_STROKE_DOWN,
        strokeWidth: CANVAS_EDGE_STROKE_WIDTH_ACTIVE,
      }
    : {
        strokeWidth: baseStyle.strokeWidth ?? CANVAS_EDGE_STROKE_WIDTH,
        ...baseStyle,
      };
  const edgeClassName = focusTone
    ? `deletable-edge pro2-edge-active pro2-edge-${focusTone}`
    : "deletable-edge";

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        interactionWidth={EDGE_HIT_WIDTH}
        className={edgeClassName}
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
