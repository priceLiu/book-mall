"use client";

import Image from "next/image";
import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STYLE_LIBRARY_CARD_FOOTER,
  STYLE_LIBRARY_CARD_SHELL,
  STYLE_LIBRARY_CARD_SUBTITLE,
  STYLE_LIBRARY_CARD_TITLE,
  STYLE_LIBRARY_HOVER_PROMPT_OVERLAY,
  STYLE_LIBRARY_MEDIA_FRAME,
  styleLibraryMediaHeightClass,
} from "@/lib/canvas/style-library-card-chrome";

export function ProjectAssetMediaCard({
  title,
  subtitle,
  hoverText,
  imageUrl,
  imageAlt,
  locked,
  busy,
  onToggleLock,
  onPreviewHero,
  footer,
  compact,
}: {
  title: string;
  subtitle: string;
  hoverText?: string;
  imageUrl?: string;
  imageAlt?: string;
  locked?: boolean;
  busy?: boolean;
  onToggleLock?: () => void;
  onPreviewHero?: () => void;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const hasImage = Boolean(imageUrl?.trim());
  const hover = (hoverText ?? "").trim();

  return (
    <article className={STYLE_LIBRARY_CARD_SHELL}>
      <div
        className={cn(
          STYLE_LIBRARY_MEDIA_FRAME,
          styleLibraryMediaHeightClass({ compact }),
          onPreviewHero && hasImage && "cursor-pointer",
        )}
        onClick={onPreviewHero && hasImage ? onPreviewHero : undefined}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onPreviewHero && hasImage) onPreviewHero();
        }}
        role={onPreviewHero && hasImage ? "button" : undefined}
        tabIndex={onPreviewHero && hasImage ? 0 : undefined}
      >
        {hasImage ? (
          <Image
            src={imageUrl!}
            alt={imageAlt ?? title}
            fill
            className="object-cover"
            unoptimized
            sizes={compact ? "140px" : "190px"}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="text-[11px] text-white/40">暂无预览图</span>
            <span className="line-clamp-2 text-[12px] text-white/70">{title}</span>
          </div>
        )}

        {hover ? (
          <div className={STYLE_LIBRARY_HOVER_PROMPT_OVERLAY} aria-hidden>
            {hover}
          </div>
        ) : null}

        {onToggleLock ? (
          <button
            type="button"
            className={cn(
              "nodrag absolute right-2 top-2 z-20 rounded-md border px-1.5 py-0.5 text-[10px] shadow-md backdrop-blur-sm",
              locked
                ? "border-amber-400/40 bg-black/70 text-amber-200"
                : "border-white/20 bg-black/60 text-white/80 hover:border-cyan-400/30",
            )}
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
          >
            {locked ? (
              <Lock className="inline size-3" />
            ) : (
              <LockOpen className="inline size-3" />
            )}{" "}
            {locked ? "已锁" : "锁定"}
          </button>
        ) : null}
      </div>

      <div className={STYLE_LIBRARY_CARD_FOOTER}>
        <p className={STYLE_LIBRARY_CARD_TITLE}>{title}</p>
        <p className={STYLE_LIBRARY_CARD_SUBTITLE}>{subtitle}</p>
        {footer}
      </div>
    </article>
  );
}
