"use client";

import { NodeResizeControl } from "@xyflow/react";

export type Pro2NodeResizerProps = {
  isVisible?: boolean;
  minWidth: number;
  minHeight: number;
  /** 默认 pro2-node-resizer-handle；标签节点等可用更小热区 */
  handleClassName?: string;
};

/** 右下角突出 tab 内容（须作为 NodeResizeControl 子节点，保证 nodrag + 命中一致） */
export function Pro2NodeResizeTabVisual() {
  return (
    <div className="pointer-events-none flex size-full items-center justify-center rounded-[3px] border border-white/45 bg-[var(--canvas-bg)] text-white/50 shadow-[0_1px_4px_rgba(0,0,0,0.35)]">
      <svg
        viewBox="0 0 16 16"
        className="size-2.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M16 6L6 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M16 10.5L10.5 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/** 2.0 可拉伸节点：右下角突出 tab（NodeResizeControl · nodrag · 非整卡拖动） */
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
      autoScale={false}
    >
      <Pro2NodeResizeTabVisual />
    </NodeResizeControl>
  );
}
