"use client";

import { Copy, ImagePlus, ZoomIn } from "lucide-react";
import { useEffect, useState } from "react";

import {
  GlobalAssetCatalogBadge,
  shouldShowCatalogPlatformBadge,
} from "@/docker-shared/global-asset-library/catalog-badge";
import {
  resolveGlobalAssetThumbUrl,
} from "@/docker-shared/global-asset-library/catalog-media-url";
import type { GlobalAssetPickItem } from "@/docker-shared/global-asset-library/types";
import { cn } from "@/lib/utils";

import { PlatformCatalogPromptCard } from "./platform-catalog-prompt-card";
import {
  platformCatalogHasPromptCopy,
  platformCatalogPreviewUrl,
  platformCatalogPromptFirst,
} from "./platform-catalog-item-utils";

const HOVER_BTN =
  "pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:scale-105 hover:bg-white";

export function PlatformCatalogImageTile({
  item,
  active,
  selectIndex,
  pickMode,
  onSelect,
  onPreview,
  onInsert,
  onCopyPrompt,
}: {
  item: GlobalAssetPickItem;
  active?: boolean;
  selectIndex?: number;
  pickMode?: boolean;
  onSelect?: () => void;
  onPreview: () => void;
  onInsert: () => void;
  onCopyPrompt: () => void;
}) {
  const [imageBroken, setImageBroken] = useState(false);
  const thumbBase = resolveGlobalAssetThumbUrl(item);

  useEffect(() => {
    setImageBroken(false);
  }, [item.id, item.thumbUrl, item.ossUrl]);

  if (platformCatalogPromptFirst(item) || imageBroken) {
    return (
      <PlatformCatalogPromptCard
        item={item}
        active={active}
        selectIndex={selectIndex}
        pickMode={pickMode}
        onSelect={onSelect}
        onCopyPrompt={onCopyPrompt}
      />
    );
  }

  const showCopy = platformCatalogHasPromptCopy(item);
  const previewUrl = platformCatalogPreviewUrl(item);

  return (
    <div
      className={cn(
        "group relative w-full overflow-hidden rounded-md border border-white/10 transition-colors hover:border-white/20",
        active && "border-cyan-400/50 ring-1 ring-cyan-400/40",
      )}
    >
      <button
        type="button"
        className="block w-full disabled:cursor-default"
        disabled={!pickMode}
        onClick={pickMode ? onSelect : undefined}
        title={item.title}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbBase}
          alt={item.title}
          className="block h-auto w-full"
          loading="lazy"
          decoding="async"
          onError={() => setImageBroken(true)}
        />
      </button>

      {shouldShowCatalogPlatformBadge(item) ? <GlobalAssetCatalogBadge /> : null}
      {active && selectIndex != null ? (
        <span className="pointer-events-none absolute right-1 top-1 z-[3] flex h-5 w-5 items-center justify-center rounded-full bg-[#22c55e] text-[10px] font-semibold text-white shadow-sm">
          {selectIndex}
        </span>
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center gap-2 bg-black/0 opacity-0 transition duration-150 group-hover:bg-black/45 group-hover:opacity-100">
        {previewUrl ? (
          <button
            type="button"
            className={HOVER_BTN}
            aria-label="预览"
            title="预览"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreview();
            }}
          >
            <ZoomIn className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
        <button
          type="button"
          className={HOVER_BTN}
          aria-label="插入画布"
          title="插入画布"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onInsert();
          }}
        >
          <ImagePlus className="h-4 w-4" strokeWidth={2} />
        </button>
        {showCopy ? (
          <button
            type="button"
            className={HOVER_BTN}
            aria-label="复制提示词"
            title="复制提示词"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onCopyPrompt();
            }}
          >
            <Copy className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </div>
  );
}
