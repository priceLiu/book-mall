"use client";

import { useCallback } from "react";
import { AlertTriangle, Copy } from "lucide-react";
import { LibtvMediaGeneratingState } from "../libtv-media-generating-state";
import type { StoryProCharacterRow } from "@/lib/canvas/story-pro-workspace-types";
import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";
import { cn } from "@/lib/utils";

function threeViewUrl(row: StoryProCharacterRow): string | undefined {
  return row.runtime?.ossUrl ?? row.runtime?.ephemeralUrl;
}

export type Pro2CharacterCellStatus = "idle" | "running" | "done" | "error";

export function pro2CharacterCellStatus(
  row: StoryProCharacterRow,
): Pro2CharacterCellStatus {
  const st = row.runtime?.status;
  if (st === "running" || st === "pending") return "running";
  if (st === "error") return "error";
  if (threeViewUrl(row)) return "done";
  return "idle";
}

export type Pro2CharacterBoardCellProps = {
  row: StoryProCharacterRow;
  focused?: boolean;
  onSelect?: () => void;
};

/** 人物设计板单格（与分镜图板图 4 同构） */
export function Pro2CharacterBoardCell({
  row,
  focused,
  onSelect,
}: Pro2CharacterBoardCellProps) {
  const url = threeViewUrl(row);
  const st = pro2CharacterCellStatus(row);
  const { ref: lazyRef, active: mediaActive } = useLazyMediaActive("160px");
  const failMessage = row.runtime?.failMessage?.trim();
  const taskId = row.runtime?.taskId?.trim();

  const copyTaskId = useCallback(() => {
    if (!taskId) return;
    void navigator.clipboard?.writeText(taskId);
  }, [taskId]);

  const Wrapper = onSelect ? "button" : "div";
  const wrapperProps = onSelect
    ? {
        type: "button" as const,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onSelect();
        },
      }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={cn(
        "nodrag relative flex min-h-[140px] w-full flex-col overflow-hidden rounded-xl border bg-[#141418] text-left transition",
        focused
          ? "border-white/40 ring-1 ring-white/12"
          : "border-white/10 hover:border-white/22",
      )}
    >
      <span className="pointer-events-none absolute left-2 top-2 z-10 max-w-[calc(100%-1rem)] truncate rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white/85">
        {row.name}
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
              alt={`${row.name} 三视图`}
              loading="lazy"
              decoding="async"
              className="size-full max-h-[280px] min-h-[140px] object-contain p-1"
            />
          ) : (
            <div className="size-full min-h-[140px] animate-pulse bg-white/[0.04]" />
          )}
        </div>
      ) : st === "running" ? (
        <div className="relative min-h-[160px] flex-1">
          <LibtvMediaGeneratingState variant="violet" />
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
            <p className="text-[10px] text-red-200/55">请修改角色描述后重试</p>
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
        <div className="flex min-h-[140px] flex-1 flex-col items-center justify-center gap-1 px-3 text-center">
          <span className="text-[11px] text-white/35">{row.name}</span>
          {row.role ? (
            <span className="line-clamp-2 text-[9px] text-white/25">
              {row.role}
            </span>
          ) : null}
        </div>
      )}
    </Wrapper>
  );
}
