"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { LibtvNodeStageLogo } from "./libtv-node-stage-logo";
import {
  LIBTV_NODE_STAGE_DRAG_CLASS,
  LibtvTryActionRow,
} from "./libtv-thin-node-try-row";

export type LibtvEmptyTryAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  disabled?: boolean;
  onClick: () => void;
};

/** 空态节点 · 左栏快捷方式 + 右栏大图标（文本/视频等媒体卡复用） */
export function LibtvEmptyTryStage({
  actions,
  stageIcon: StageIcon,
  className,
}: {
  actions: LibtvEmptyTryAction[];
  stageIcon: LucideIcon;
  className?: string;
}) {
  return (
    <div
      className={cn(
        LIBTV_NODE_STAGE_DRAG_CLASS,
        "flex min-h-0 flex-1 flex-col px-3 pb-3 pt-2",
        className,
      )}
    >
      <p className="mb-2 text-[11px] text-white/45">尝试：</p>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
        <div className="min-w-0">
          <ul className="space-y-0.5">
            {actions.map((action) => (
              <li key={action.id}>
                <LibtvTryActionRow
                  icon={action.icon}
                  label={action.label}
                  disabled={action.disabled}
                  onClick={action.onClick}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="flex min-w-0 items-center justify-center">
          <LibtvNodeStageLogo icon={StageIcon} />
        </div>
      </div>
    </div>
  );
}
