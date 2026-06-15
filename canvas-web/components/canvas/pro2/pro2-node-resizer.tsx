"use client";

import { NodeResizeControl } from "@xyflow/react";
import {
  PRO2_NODE_RESIZER_HANDLE,
} from "@/lib/canvas/story-pro2-node-chrome";

const HANDLE_POSITIONS = [
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type Pro2NodeResizerProps = {
  isVisible?: boolean;
  minWidth: number;
  minHeight: number;
};

/** 2.0 节点拉伸：仅四角把手（不渲染边线，避免误触只能改高/宽的单向缩放） */
export function Pro2NodeResizer({
  isVisible,
  minWidth,
  minHeight,
}: Pro2NodeResizerProps) {
  if (!isVisible) return null;
  return (
    <>
      {HANDLE_POSITIONS.map((position) => (
        <NodeResizeControl
          key={position}
          position={position}
          minWidth={minWidth}
          minHeight={minHeight}
          color="transparent"
          className="pro2-node-resizer-handle"
          style={PRO2_NODE_RESIZER_HANDLE}
        />
      ))}
    </>
  );
}
