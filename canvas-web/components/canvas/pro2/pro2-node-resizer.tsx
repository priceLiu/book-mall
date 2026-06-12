"use client";

import { NodeResizer } from "@xyflow/react";
import {
  PRO2_NODE_RESIZER_HANDLE,
  PRO2_NODE_RESIZER_LINE,
} from "@/lib/canvas/story-pro2-node-chrome";

export type Pro2NodeResizerProps = {
  isVisible?: boolean;
  minWidth: number;
  minHeight: number;
};

/** 2.0 节点拉伸：无外框线，角点把手见 globals.css `.pro2-node-resizer-handle` */
export function Pro2NodeResizer({
  isVisible,
  minWidth,
  minHeight,
}: Pro2NodeResizerProps) {
  return (
    <NodeResizer
      isVisible={isVisible}
      minWidth={minWidth}
      minHeight={minHeight}
      color="transparent"
      lineStyle={PRO2_NODE_RESIZER_LINE}
      handleClassName="pro2-node-resizer-handle"
      handleStyle={PRO2_NODE_RESIZER_HANDLE}
    />
  );
}
