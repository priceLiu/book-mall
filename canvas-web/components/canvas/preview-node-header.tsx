"use client";

import { Eye } from "lucide-react";

import type { CanvasNodeRuntime } from "@/lib/canvas/types";
import { NodeStatusBadge } from "./node-shell";

/** 预览节点标题栏：就绪 + 全屏预览 */
export function PreviewNodeHeader({
  status = "idle",
  failMessage,
  previewDisabled,
  onPreview,
}: {
  status?: CanvasNodeRuntime["status"];
  failMessage?: string | null;
  previewDisabled?: boolean;
  onPreview: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <NodeStatusBadge status={status} message={failMessage ?? null} />
      <button
        type="button"
        disabled={previewDisabled}
        className="nodrag inline-flex items-center gap-0.5 rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-white/85 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
        onClick={(e) => {
          e.stopPropagation();
          onPreview();
        }}
      >
        <Eye className="size-3" /> 预览
      </button>
    </div>
  );
}
