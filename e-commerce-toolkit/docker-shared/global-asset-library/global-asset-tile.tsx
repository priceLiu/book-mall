"use client";

import { ZoomIn, X } from "lucide-react";
import { useState } from "react";
import { createPortal } from "react-dom";

import {
  resolveGlobalAssetPreviewUrl,
  resolveGlobalAssetThumbUrl,
} from "./catalog-media-url";
import { GlobalAssetCatalogBadge, shouldShowCatalogPlatformBadge } from "./catalog-badge";
import { GALD_CLOSE_BTN_CLASS, GALD_TILE_CLASS } from "./theme";
import type { GlobalAssetLibraryVariant, GlobalAssetPickItem } from "./types";
import { globalAssetTheme } from "./theme";

type Props = {
  item: GlobalAssetPickItem;
  variant: GlobalAssetLibraryVariant;
  active: boolean;
  selectIndex?: number;
  scopeText: string;
  disabled?: boolean;
  onSelect?: () => void;
};

function GlobalAssetPreviewLightbox({
  item,
  variant,
  onClose,
}: {
  item: GlobalAssetPickItem;
  variant: GlobalAssetLibraryVariant;
  onClose: () => void;
}) {
  const theme = globalAssetTheme(variant);

  return createPortal(
    <div
      className="fixed inset-0 z-[410] flex items-center justify-center bg-black/80 p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`预览 ${item.title}`}
      onClick={onClose}
    >
      <button
        type="button"
        className={`absolute right-4 top-4 ${GALD_CLOSE_BTN_CLASS} ${theme.btnSecondary}`}
        aria-label="关闭预览"
        onClick={onClose}
      >
        <X className="h-5 w-5" />
      </button>
      <div
        className={`max-h-[88vh] max-w-[min(92vw,960px)] overflow-hidden rounded-xl border shadow-2xl ${theme.shell} ${theme.border}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolveGlobalAssetPreviewUrl(item)}
          alt={item.title}
          className="max-h-[72vh] w-full object-contain bg-black/5"
        />
        <div className={`border-t px-4 py-2.5 ${theme.header}`}>
          <p className={`text-sm font-medium ${theme.textPrimary}`}>{item.title}</p>
          {item.description ? (
            <p className={`mt-1 text-xs leading-relaxed ${theme.textSecondary}`}>{item.description}</p>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function GlobalAssetTile({
  item,
  variant,
  active,
  selectIndex,
  scopeText,
  disabled,
  onSelect,
}: Props) {
  const theme = globalAssetTheme(variant);
  const [previewOpen, setPreviewOpen] = useState(false);

  const thumbUrl = resolveGlobalAssetThumbUrl(item);
  const canPreview = Boolean(resolveGlobalAssetPreviewUrl(item)) && !item.promptOnly;
  const showPlatformBadge = shouldShowCatalogPlatformBadge(item);

  return (
    <>
      <div className={`group relative ${GALD_TILE_CLASS} ${theme.border} ${theme.cardHover} ${
        active ? theme.cardSelected : ""
      }`}>
        <button
          type="button"
          disabled={disabled}
          className="absolute inset-0 h-full w-full disabled:cursor-default"
          onClick={onSelect}
          title={item.description ?? item.title}
        >
          {item.promptOnly ? (
            <div className={`flex h-full flex-col justify-between p-2 text-left ${theme.textSecondary}`}>
              <span className="line-clamp-2 text-[10px] font-medium leading-snug">{item.title}</span>
              <span className="line-clamp-4 text-[9px] leading-snug opacity-80">
                {item.description ?? "姿势提示词"}
              </span>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbUrl}
              alt={item.title}
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          )}
        </button>

        <span className={`pointer-events-none absolute left-0.5 top-0.5 z-[2] rounded px-1 py-0.5 text-[9px] ${theme.pill}`}>
          {scopeText}
        </span>
        {showPlatformBadge ? <GlobalAssetCatalogBadge /> : null}
        {active && selectIndex != null ? (
          <span className="pointer-events-none absolute right-0.5 top-0.5 z-[3] flex h-4 w-4 items-center justify-center rounded-full bg-[#22c55e] text-[9px] font-semibold text-white shadow-sm">
            {selectIndex}
          </span>
        ) : null}

        {canPreview ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/0 opacity-0 transition duration-150 group-hover:bg-black/40 group-hover:opacity-100">
            <button
              type="button"
              className="pointer-events-auto flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-[#1d1d1f] shadow-md transition hover:scale-105 hover:bg-white"
              aria-label="放大预览"
              title="放大预览"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setPreviewOpen(true);
              }}
            >
              <ZoomIn className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        ) : null}
      </div>

      {previewOpen && canPreview ? (
        <GlobalAssetPreviewLightbox
          item={item}
          variant={variant}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
