"use client";

import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** 节点右下角拉伸指示（对角线 · 仅视觉，交互由 NodeResizeControl 承担） */
export function Pro2NodeResizeGrip({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute bottom-1.5 right-1.5 z-20 text-white/40",
        className,
      )}
      style={style}
      aria-hidden
    >
      <svg
        viewBox="0 0 16 16"
        className="size-4"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 5L5 16"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
        <path
          d="M16 9.5L9.5 16"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
