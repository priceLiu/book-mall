"use client";

import { useCallback, useState } from "react";
import { Download, Eye } from "lucide-react";

import { MediaPreviewLightbox } from "@/components/canvas/media-hover-box";

const ACTION_BTN =
  "inline-flex min-w-[52px] flex-col items-center gap-1 rounded-xl border border-white/25 bg-black/75 px-3 py-2.5 text-white shadow-xl transition hover:scale-[1.03] hover:border-white/50 hover:bg-black/90";
const ACTION_ICON = "grid size-11 place-items-center rounded-full bg-white/10";

export function GalleryMediaCard({
  src,
  alt,
  title,
  subtitle,
  downloadName,
}: {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
  downloadName?: string;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

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
      <div className="group rounded-xl border border-[var(--canvas-border)] bg-[var(--canvas-surface)] p-2 transition hover:border-[var(--canvas-accent)]/40">
        <div className="group/media relative aspect-square overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="h-full w-full object-cover transition group-hover/media:scale-[1.02]"
            loading="lazy"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-3 bg-black/0 opacity-0 transition group-hover/media:bg-black/45 group-hover/media:opacity-100">
            <button
              type="button"
              title="预览大图"
              onClick={openPreview}
              className={`${ACTION_BTN} pointer-events-auto`}
            >
              <span className={ACTION_ICON}>
                <Eye className="size-6" strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-medium text-white/90">预览</span>
            </button>
            <button
              type="button"
              title="下载"
              onClick={onDownload}
              className={`${ACTION_BTN} pointer-events-auto`}
            >
              <span className={ACTION_ICON}>
                <Download className="size-6" strokeWidth={1.75} />
              </span>
              <span className="text-[11px] font-medium text-white/90">下载</span>
            </button>
          </div>
        </div>
        <div className="px-1 pb-1 pt-2">
          <p className="truncate text-xs text-white">{title}</p>
          {subtitle ? (
            <p className="truncate text-[10px] text-[var(--canvas-muted)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {previewOpen ? (
        <MediaPreviewLightbox
          src={src}
          kind="image"
          alt={alt}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </>
  );
}
