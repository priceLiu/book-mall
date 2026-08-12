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
  /** chrome = 深色助手栏；content = 浅色主内容区 */
  surface?: "chrome" | "content";
};

/** 助手区 / 内容区任务状态卡 */
export function StoryboardTaskStatus({
  title,
  detail,
  progress,
  active,
  className,
  surface = "chrome",
}: Props) {
  const [open, setOpen] = useState(true);
  if (!active) return null;

  const isContent = surface === "content";

  return (
    <div
      className={cn(
        "mx-4 mb-3 rounded-xl border",
        isContent
          ? "border-[#e8e8ed] bg-[var(--ecom-content-highlight)]"
          : "border-[var(--ecom-chrome-accent)]/35 bg-[var(--ecom-chrome-accent)]/15",
        className,
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Loader2
          className={cn(
            "h-4 w-4 shrink-0 animate-spin",
            isContent ? "text-[var(--ecom-chrome-accent)]" : "text-[var(--ecom-primary-on-dark)]",
          )}
        />
        <span
          className={cn(
            "flex-1 text-sm font-medium",
            isContent ? "text-[var(--ecom-ink)]" : "text-[var(--ecom-primary-on-dark)]",
          )}
        >
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-[#6e6e73]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#6e6e73]" />
        )}
      </button>
      {open ? (
        <div
          className={cn(
            "space-y-2 border-t px-3 py-2.5",
            isContent
              ? "border-[#e8e8ed]"
              : "border-[var(--ecom-chrome-accent)]/25",
          )}
        >
          {detail ? (
            <p className="text-xs leading-relaxed text-[#6e6e73]">{detail}</p>
          ) : null}
          {progress ? (
            <p
              className={cn(
                "text-xs font-medium",
                isContent ? "text-[var(--ecom-ink)]" : "text-[#1d1d1f]",
              )}
            >
              {progress.label ?? "进度"}：{progress.current}/{progress.total}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
