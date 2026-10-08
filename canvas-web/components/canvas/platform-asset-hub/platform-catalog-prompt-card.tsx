"use client";

import { Copy } from "lucide-react";

import { GlobalAssetCatalogBadge } from "@/docker-shared/global-asset-library/catalog-badge";
import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import { cn } from "@/lib/utils";

import {
  platformCatalogHasPromptCopy,
  platformCatalogPromptBody,
} from "./platform-catalog-item-utils";

const ICON_BTN =
  "flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:scale-105 hover:bg-white";

export function PlatformCatalogPromptCard({
  item,
  active,
  selectIndex,
  pickMode,
  onSelect,
  onCopyPrompt,
}: {
  item: GlobalAssetPickItem;
  active?: boolean;
  selectIndex?: number;
  pickMode?: boolean;
  onSelect?: () => void;
  onCopyPrompt: () => void;
}) {
  const body = platformCatalogPromptBody(item);
  const showCopy = platformCatalogHasPromptCopy(item);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-white/10 bg-white/[0.03] p-3 text-left transition-colors",
        pickMode && "cursor-pointer hover:border-white/20",
        active && "border-cyan-400/50 bg-cyan-500/10",
      )}
      role={pickMode ? "button" : undefined}
      tabIndex={pickMode ? 0 : undefined}
      onClick={pickMode ? onSelect : undefined}
      onKeyDown={
        pickMode
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-white">{item.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          {showCopy ? (
            <button
              type="button"
              className={ICON_BTN}
              aria-label="复制提示词"
              title="复制提示词"
              onClick={(e) => {
                e.stopPropagation();
                onCopyPrompt();
              }}
            >
              <Copy className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-2 line-clamp-6 text-[10px] leading-relaxed text-white/60">{body}</p>
      <GlobalAssetCatalogBadge />
      {active && selectIndex != null ? (
        <span className="pointer-events-none absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-[10px] font-semibold text-white shadow-sm">
          {selectIndex}
        </span>
      ) : null}
    </div>
  );
}
