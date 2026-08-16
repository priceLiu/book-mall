"use client";

import { Maximize2, Minimize2 } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  composerWide?: boolean;
  onComposerWideChange?: (wide: boolean) => void;
  /** 展开钮左侧（如微剧「影片参数」） */
  trailing?: React.ReactNode;
};

/** 电商工具箱 · 右侧助手会话顶栏（手伴创作基准） */
export function EcomAssistantPanelHeader({
  title,
  subtitle,
  composerWide = false,
  onComposerWideChange,
  trailing,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--ecom-assistant-border)] bg-[var(--ecom-assistant-bg)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#1d1d1f]">{title}</p>
        {subtitle ? (
          <p className="truncate text-[10px] text-[#6e6e73]">{subtitle}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {trailing}
        {onComposerWideChange ? (
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[var(--ecom-chrome-accent)]"
            title={composerWide ? "收窄会话区" : "加宽会话区"}
            onClick={() => onComposerWideChange(!composerWide)}
          >
            {composerWide ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
