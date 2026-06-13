"use client";

import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { isProjectAssetVideoUrl } from "@/lib/canvas/project-asset-preview";
import {
  ProjectAssetHoverPreviewLayer,
  useProjectAssetHoverPreview,
} from "@/components/canvas/project-asset-hover-preview";
import {
  STYLE_LIBRARY_CARD_FOOTER,
  STYLE_LIBRARY_CARD_SHELL,
  STYLE_LIBRARY_CARD_SUBTITLE,
  STYLE_LIBRARY_CARD_TITLE,
  STYLE_LIBRARY_HOVER_PROMPT_OVERLAY,
  STYLE_LIBRARY_MEDIA_FRAME,
  STYLE_LIBRARY_PREVIEW_ASPECT,
  STYLE_LIBRARY_PREVIEW_IMG_CLASS,
  styleLibraryMediaHeightClass,
} from "@/lib/canvas/style-library-card-chrome";

export type ProjectAssetGalleryItem = {
  id: string;
  url: string;
  label: string;
  mimeType?: string | null;
};

function ProjectAssetGalleryGrid({
  items,
  title,
  onHoverPreviewShow,
  onHoverPreviewHide,
  onPreview,
}: {
  items: ProjectAssetGalleryItem[];
  title: string;
  onHoverPreviewShow?: (args: {
    url: string;
    title: string;
    anchor: HTMLElement;
    mimeType?: string | null;
  }) => void;
  onHoverPreviewHide?: () => void;
  onPreview?: (url: string, label: string) => void;
}) {
  const shown = items.slice(0, 4);
  const extra = items.length - shown.length;
  const count = shown.length;

  return (
    <div
      className={cn(
        STYLE_LIBRARY_PREVIEW_ASPECT,
        "relative grid gap-px bg-white/10",
        count === 2 && "grid-cols-2 grid-rows-1",
        count === 3 && "grid-cols-2 grid-rows-2",
        count >= 4 && "grid-cols-2 grid-rows-2",
      )}
    >
      {shown.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={cn(
            "nodrag relative min-h-0 overflow-hidden bg-black/40",
            shown.length === 3 && index === 2 && "col-span-2",
          )}
          title={item.label}
          onMouseEnter={(e) =>
            onHoverPreviewShow?.({
              url: item.url,
              title: `${title} · ${item.label}`,
              anchor: e.currentTarget,
              mimeType: item.mimeType,
            })
          }
          onMouseLeave={() => onHoverPreviewHide?.()}
          onClick={() => onPreview?.(item.url, item.label)}
        >
          {isProjectAssetVideoUrl(item.url, item.mimeType) ? (
            <video
              src={item.url}
              className="size-full object-cover"
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- OSS 外链预览
            <img
              src={item.url}
              alt={item.label}
              className="size-full object-cover"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
          )}
          <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-0.5 py-0.5 text-center text-[7px] text-white/85">
            {item.label}
          </span>
        </button>
      ))}
      {extra > 0 ? (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 z-10 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
          +{extra}
        </span>
      ) : null}
    </div>
  );
}

export function ProjectAssetMediaCard({
  title,
  subtitle,
  hoverText,
  imageUrl,
  imageAlt,
  previewMimeType,
  galleryItems,
  enableHoverZoom = false,
  onHoverPreviewShow,
  onHoverPreviewHide,
  locked,
  busy,
  onToggleLock,
  onPreviewHero,
  onPreviewGalleryItem,
  footer,
  compact,
}: {
  title: string;
  subtitle: string;
  hoverText?: string;
  imageUrl?: string;
  imageAlt?: string;
  previewMimeType?: string | null;
  /** 组资产等多图：主区域 2×2 拼图 */
  galleryItems?: ProjectAssetGalleryItem[];
  /** 悬停媒体区时左侧弹出放大预览 */
  enableHoverZoom?: boolean;
  onHoverPreviewShow?: (args: {
    url: string;
    title: string;
    anchor: HTMLElement;
    mimeType?: string | null;
  }) => void;
  onHoverPreviewHide?: () => void;
  locked?: boolean;
  busy?: boolean;
  onToggleLock?: () => void;
  onPreviewHero?: () => void;
  onPreviewGalleryItem?: (url: string, label: string) => void;
  footer?: React.ReactNode;
  compact?: boolean;
}) {
  const useGallery = (galleryItems?.length ?? 0) >= 2;
  const hasImage = useGallery || Boolean(imageUrl?.trim());
  const hover = (hoverText ?? "").trim();
  const hoverZoom = enableHoverZoom && hasImage && !useGallery;
  const useExternalHover = Boolean(onHoverPreviewShow);
  const internalHover = useProjectAssetHoverPreview(
    hoverZoom && !useExternalHover,
  );
  const showHoverPreview = onHoverPreviewShow ?? internalHover.showHoverPreview;
  const hideHoverPreview = onHoverPreviewHide ?? internalHover.hideHoverPreview;
  const hoverPreview = useExternalHover ? null : internalHover.hoverPreview;

  return (
    <article className={STYLE_LIBRARY_CARD_SHELL}>
      <div
        className={cn(
          STYLE_LIBRARY_MEDIA_FRAME,
          !hasImage && STYLE_LIBRARY_PREVIEW_ASPECT,
          styleLibraryMediaHeightClass({ compact }),
          !useGallery &&
            ((onPreviewHero && hasImage) || hoverZoom
              ? "cursor-pointer"
              : undefined),
        )}
        onClick={
          !useGallery && onPreviewHero && hasImage ? onPreviewHero : undefined
        }
        onKeyDown={(e) => {
          if (useGallery) return;
          if (e.key === "Enter" && onPreviewHero && hasImage) onPreviewHero();
        }}
        role={
          !useGallery && onPreviewHero && hasImage ? "button" : undefined
        }
        tabIndex={
          !useGallery && onPreviewHero && hasImage ? 0 : undefined
        }
        onMouseEnter={(e) => {
          if (useGallery || !hoverZoom || !imageUrl) return;
          showHoverPreview({
            url: imageUrl,
            title,
            anchor: e.currentTarget,
            mimeType: previewMimeType,
          });
        }}
        onMouseLeave={() => {
          if (useGallery) return;
          hideHoverPreview();
        }}
      >
        {useGallery && galleryItems ? (
          <ProjectAssetGalleryGrid
            items={galleryItems}
            title={title}
            onHoverPreviewShow={onHoverPreviewShow ?? showHoverPreview}
            onHoverPreviewHide={onHoverPreviewHide ?? hideHoverPreview}
            onPreview={onPreviewGalleryItem}
          />
        ) : hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- OSS 外链预览
          <img
            src={imageUrl!}
            alt={imageAlt ?? title}
            className={STYLE_LIBRARY_PREVIEW_IMG_CLASS}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-3 text-center">
            <span className="text-[11px] text-white/40">暂无预览图</span>
            <span className="line-clamp-2 text-[12px] text-white/70">{title}</span>
          </div>
        )}

        {hover && !hoverZoom ? (
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

      <ProjectAssetHoverPreviewLayer state={hoverPreview} />
    </article>
  );
}
