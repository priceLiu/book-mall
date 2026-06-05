"use client";

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  detail?: string;
  progress?: { current: number; total: number; label?: string };
  active?: boolean;
  className?: string;
};

/** 助手区 / 内容区任务状态卡 */
export function StoryboardTaskStatus({ title, detail, progress, active, className }: Props) {
  const [open, setOpen] = useState(true);
  if (!active) return null;

  return (
    <div
      className={cn(
        "mx-4 mb-3 rounded-xl border border-[#0071e3]/25 bg-[#0071e3]/5",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" />
        <span className="flex-1 text-sm font-medium text-[#0071e3]">{title}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[#6e6e73]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#6e6e73]" />
        )}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[#0071e3]/15 px-3 py-2.5">
          {detail ? <p className="text-xs leading-relaxed text-[#6e6e73]">{detail}</p> : null}
          {progress ? (
            <p className="text-xs font-medium text-[#1d1d1f]">
              {progress.label ?? "进度"}：{progress.current}/{progress.total}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
