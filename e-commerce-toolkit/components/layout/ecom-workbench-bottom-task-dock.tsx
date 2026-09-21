"use client";

import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

export type EcomWorkbenchBottomTaskDockProps = {
  active: boolean;
  title: string;
  detail?: string;
  /** 0–100；null/undefined 为不确定进度 */
  progress?: number | null;
  sweep?: boolean;
  /**
   * workspace：贴主内容区底、与 px-5 栏同宽（详情页套图等）
   * viewport：固定视口底（慎用，易与侧栏错位）
   */
  placement?: "workspace" | "viewport";
};

function EcomWorkbenchBottomTaskDockInner({
  title,
  detail,
  progress = null,
  sweep = true,
  open,
  onToggleOpen,
}: Omit<EcomWorkbenchBottomTaskDockProps, "active" | "placement"> & {
  open: boolean;
  onToggleOpen: () => void;
}) {
  const pct =
    typeof progress === "number"
      ? Math.min(100, Math.max(0, Math.round(progress)))
      : null;

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-[#0071e3]/25 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
        sweep && "ecom-media-generating-sweep",
      )}
    >
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
        onClick={onToggleOpen}
      >
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0071e3]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#0071e3]">{title}</p>
          {!open && detail ? (
            <p className="truncate text-[11px] text-[#86868b]">{detail}</p>
          ) : null}
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-[#86868b]" aria-hidden />
        ) : (
          <ChevronUp className="h-4 w-4 shrink-0 text-[#86868b]" aria-hidden />
        )}
      </button>
      {open ? (
        <div className="space-y-2 border-t border-[#e8e8ed] px-3 py-2.5">
          {detail ? (
            <p className="text-xs leading-relaxed text-[#6e6e73]">{detail}</p>
          ) : null}
          <div
            className={cn(
              "ecom-upload-progress h-1",
              pct == null && "ecom-upload-progress-indeterminate",
            )}
          >
            <span style={pct != null ? { width: `${pct}%` } : undefined} />
          </div>
          {pct != null ? (
            <p className="text-[10px] font-medium text-[#0071e3]">{pct}%</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 工作台统一底栏任务态（识图 / 拆解 / 重写 / 出图等）。
 */
export function EcomWorkbenchBottomTaskDock({
  active,
  placement = "workspace",
  ...innerProps
}: EcomWorkbenchBottomTaskDockProps) {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => setMounted(true), []);

  if (!active) return null;

  const shell = (
    <div
      className={cn(
        "shrink-0 px-5 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        placement === "workspace" && "border-t border-[#e8e8ed] bg-white",
      )}
      data-ecom-workbench-bottom-task-dock
      role="status"
      aria-live="polite"
    >
      <EcomWorkbenchBottomTaskDockInner
        {...innerProps}
        open={open}
        onToggleOpen={() => setOpen((v) => !v)}
      />
    </div>
  );

  if (placement === "viewport") {
    if (!mounted) return null;
    return createPortal(
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[88] px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-2">
        <div className="pointer-events-auto">{shell}</div>
      </div>,
      document.body,
    );
  }

  return shell;
}
