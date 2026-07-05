"use client";

import { ChevronDown } from "lucide-react";
import { useLibtvDockToolbarMetrics } from "@/lib/canvas/use-libtv-dock-toolbar-metrics";
import { cn } from "@/lib/utils";

/** Dock 底栏 · 模型/参数设置触发钮（屏上 27px · 与视频节点一致） */
export function LibtvDockSettingsTrigger({
  label,
  disabled,
  className,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}) {
  const { fontPx, minHeightPx, chevronPx } = useLibtvDockToolbarMetrics();

  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "nodrag flex min-w-0 flex-1 items-center gap-1 rounded-md px-2.5 py-2 text-left text-white hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={{ fontSize: fontPx, minHeight: minHeightPx }}
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <ChevronDown
        className="shrink-0 opacity-45"
        style={{ width: chevronPx, height: chevronPx }}
      />
    </button>
  );
}
