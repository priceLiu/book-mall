"use client";

import { NodeResizeControl } from "@xyflow/react";

export type Pro2NodeResizerProps = {
  isVisible?: boolean;
  minWidth: number;
  minHeight: number;
  /** 默认 pro2-node-resizer-handle；标签节点等可用更小热区 */
  handleClassName?: string;
};

/** 2.0 可拉伸节点：仅右下角大热区把手（不渲染边线） */
export function Pro2NodeResizer({
  isVisible,
  minWidth,
  minHeight,
  handleClassName = "pro2-node-resizer-handle",
}: Pro2NodeResizerProps) {
  if (!isVisible) return null;
  return (
    <NodeResizeControl
      position="bottom-right"
      minWidth={minWidth}
      minHeight={minHeight}
      color="transparent"
      className={handleClassName}
    />
  );
}
