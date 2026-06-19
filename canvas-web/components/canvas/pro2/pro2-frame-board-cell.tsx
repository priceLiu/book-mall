"use client";

import { useCallback } from "react";
import { AlertTriangle, Copy, Loader2 } from "lucide-react";
import type { StoryProFrameRow } from "@/lib/canvas/story-pro-workspace-types";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";
import { cn } from "@/lib/utils";

function frameImageUrl(row: StoryProFrameRow): string | undefined {
  return (
    row.runtime?.ossUrl ??
    row.runtime?.ephemeralUrl ??
    row.refImageUrls?.[0]
  );
}

export type Pro2FrameCellStatus = "idle" | "running" | "done" | "error";

export function pro2FrameCellStatus(row: StoryProFrameRow): Pro2FrameCellStatus {
  const st = row.runtime?.status;
  if (st === "running" || st === "pending") return "running";
  if (st === "error") return "error";
  if (frameImageUrl(row)) return "done";
  return "idle";
}

export type Pro2FrameBoardCellProps = {
  row: StoryProFrameRow;
  focused?: boolean;
  onSelect: () => void;
  cellId?: string;
};

/** 分镜图板单格（图 4：大图 + 完整失败信息 + TaskID） */
export function Pro2FrameBoardCell({
  row,
  focused,
  onSelect,
  cellId,
}: Pro2FrameBoardCellProps) {
  const url = frameImageUrl(row);
  const st = pro2FrameCellStatus(row);
  const { ref: lazyRef, active: mediaActive } = useLazyMediaActive("160px");
  const failMessage = row.runtime?.failMessage?.trim();
  const taskId = row.runtime?.taskId?.trim();

  const copyTaskId = useCallback(() => {
    if (!taskId) return;
    void navigator.clipboard?.writeText(taskId);
  }, [taskId]);

  return (
    <button
      type="button"
      data-pro2-frame-cell={cellId}
      className={cn(
        "nodrag relative flex min-h-[140px] w-full flex-col overflow-hidden rounded-xl border bg-[#141418] text-left transition",
        focused
          ? "border-white/40 ring-1 ring-white/12"
          : "border-white/10 hover:border-white/22",
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="pointer-events-none absolute left-2 top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/85">
        {row.frameIndex}
      </span>

      {url ? (
        <div
          ref={lazyRef}
          className="relative min-h-[160px] w-full flex-1"
        >
          {mediaActive ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={`镜 ${row.frameIndex}`}
              loading="lazy"
              decoding="async"
              className="size-full max-h-[280px] min-h-[140px] object-contain p-1"
            />
          ) : (
            <div className="size-full min-h-[140px] animate-pulse bg-white/[0.04]" />
          )}
        </div>
      ) : st === "running" ? (
        <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-[11px] text-white/50">
          <Loader2 className="size-6 animate-spin text-violet-300/70" />
          <span>生成中…</span>
        </div>
      ) : st === "error" ? (
        <div className="flex min-h-[160px] flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
          <AlertTriangle className="size-7 text-red-400/90" strokeWidth={1.5} />
          <p className="text-[13px] font-medium text-red-300/95">生成失败</p>
          {failMessage ? (
            <p className="max-w-full text-[10px] leading-relaxed text-red-200/75">
              {failMessage}
            </p>
          ) : (
            <p className="text-[10px] text-red-200/55">请修改描述或素材后重试</p>
          )}
          {taskId ? (
            <div className="mt-1 flex max-w-full items-center gap-1.5 rounded-md border border-white/8 bg-black/35 px-2 py-1">
              <span className="truncate font-mono text-[9px] text-white/45">
                {taskId}
              </span>
              <button
                type="button"
                className="nodrag shrink-0 rounded p-0.5 text-white/40 hover:bg-white/8 hover:text-white/70"
                title="复制 TaskID"
                onClick={(e) => {
                  e.stopPropagation();
                  copyTaskId();
                }}
              >
                <Copy className="size-3" />
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-[140px] flex-1 items-center justify-center text-[11px] text-white/30">
          镜 {row.frameIndex}
        </div>
      )}
    </button>
  );
}
