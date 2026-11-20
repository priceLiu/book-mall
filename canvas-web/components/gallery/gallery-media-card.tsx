"use client";

import { useCallback, useState } from "react";
import { Download, Play, ZoomIn } from "lucide-react";

import {
  isVideoMediaUrl,
  MediaPreviewLightbox,
} from "@/components/canvas/media-hover-box";
import {
  STYLE_LIBRARY_CARD_FOOTER,
  STYLE_LIBRARY_CARD_SHELL,
  STYLE_LIBRARY_CARD_SUBTITLE,
  STYLE_LIBRARY_CARD_TITLE,
  STYLE_LIBRARY_HOVER_ACTION_BTN,
  STYLE_LIBRARY_MEDIA_FRAME,
  STYLE_LIBRARY_PREVIEW_IMG_CLASS,
  styleLibraryMediaHeightClass,
} from "@/lib/canvas/style-library-card-chrome";
import { cn } from "@/lib/utils";

export function GalleryMediaCard({
  src,
  alt,
  title,
  subtitle,
  downloadName,
  mediaKind,
  posterUrl,
  thumbnailUrl,
}: {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
  downloadName?: string;
  mediaKind?: "image" | "video";
  posterUrl?: string | null;
  thumbnailUrl?: string | null;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const kind = mediaKind ?? (isVideoMediaUrl(src) ? "video" : "image");
  const poster = posterUrl?.trim() || thumbnailUrl?.trim() || undefined;
  const thumbSrc = kind === "video" ? poster : poster ?? thumbnailUrl?.trim() ?? src;

  const openPreview = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPreviewOpen(true);
  }, []);

  const onDownload = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const a = document.createElement("a");
      a.href = src;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      if (downloadName) a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    },
    [src, downloadName],
  );

  return (
    <>
      <article className={cn("group/card", STYLE_LIBRARY_CARD_SHELL)}>
        <div
          className={cn(
            STYLE_LIBRARY_MEDIA_FRAME,
            styleLibraryMediaHeightClass(),
          )}
        >
          {kind === "video" && thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt={alt}
              className={STYLE_LIBRARY_PREVIEW_IMG_CLASS}
              loading="lazy"
            />
          ) : kind === "video" ? (
            <video
              src={src}
              className={STYLE_LIBRARY_PREVIEW_IMG_CLASS}
              muted
              playsInline
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt={alt}
              className={STYLE_LIBRARY_PREVIEW_IMG_CLASS}
              loading="lazy"
            />
          )}
          {kind === "video" ? (
            <span className="pointer-events-none absolute bottom-2 right-2 z-10 inline-flex size-7 items-center justify-center rounded-full bg-black/65 text-white">
              <Play className="size-3.5 fill-current" />
            </span>
          ) : null}
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition duration-150 group-hover/card:bg-black/45 group-hover/card:opacity-100">
            <button
              type="button"
              title="预览"
              onClick={openPreview}
              className={STYLE_LIBRARY_HOVER_ACTION_BTN}
            >
              <ZoomIn className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              title="下载"
              onClick={onDownload}
              className={STYLE_LIBRARY_HOVER_ACTION_BTN}
            >
              <Download className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
        <div className={STYLE_LIBRARY_CARD_FOOTER}>
          <p className={STYLE_LIBRARY_CARD_TITLE}>{title}</p>
          {subtitle ? (
            <p className={STYLE_LIBRARY_CARD_SUBTITLE}>{subtitle}</p>
          ) : null}
        </div>
      </article>

      {previewOpen ? (
        <MediaPreviewLightbox
          src={src}
          kind={kind}
          alt={alt}
          posterUrl={poster}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}