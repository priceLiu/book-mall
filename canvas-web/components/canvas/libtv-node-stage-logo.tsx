"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { LIBTV_NODE_STAGE_DRAG_CLASS } from "./libtv-thin-node-try-row";

/** LibTV 节点舞台 · 空态/连线态大图标（全节点统一尺寸） */
export const LIBTV_NODE_STAGE_LOGO_CLASS = "size-28 text-white/20";

export function LibtvNodeStageLogo({
  icon: Icon,
  className,
}: {
  icon: LucideIcon;
  className?: string;
}) {
  return (
    <Icon
      className={cn(LIBTV_NODE_STAGE_LOGO_CLASS, className)}
      strokeWidth={1.25}
    />
  );
}

/** 已连线、尚无内容 · 居中 logo + 可选说明 */
export function LibtvNodeLinkedStage({
  stageIcon: StageIcon,
  message,
  className,
}: {
  stageIcon: LucideIcon;
  message?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        LIBTV_NODE_STAGE_DRAG_CLASS,
        "flex flex-col items-center justify-center gap-2 px-4 text-center",
        className,
      )}
    >
      <LibtvNodeStageLogo icon={StageIcon} />
      {message ? (
        <p className="text-[11px] text-white/45">{message}</p>
      ) : null}
    </div>
  );
}
