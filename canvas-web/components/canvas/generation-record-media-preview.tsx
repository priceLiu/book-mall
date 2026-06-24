"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { createPortal } from "react-dom";

import type { CanvasGenerationRecord } from "@/lib/canvas-api";
import {
  resolveGenerationRecordMedia,
  type GenerationRecordMediaItem,
} from "@/lib/canvas/generation-record-preview";
import { cn } from "@/lib/utils";

function computePreviewPosition(
  rect: DOMRect,
  previewW: number,
  previewH: number,
): { left: number; top: number } {
  const gap = 12;
  const margin = 10;
  let left = rect.left - previewW - gap;
  let top = rect.top + rect.height / 2 - previewH / 2;

  if (left < margin) {
    left = rect.right + gap;
  }
  if (left + previewW > window.innerWidth - margin) {
    left = Math.max(
      margin,
      Math.min(
        window.innerWidth - previewW - margin,
        rect.left + rect.width / 2 - previewW / 2,
      ),
    );
    top = rect.top - previewH - gap;
  }

  top = Math.max(
    margin,
    Math.min(window.innerHeight - previewH - margin, top),
  );
  return { left, top };
}

function MediaTile({
  item,
  className,
  showPlayBadge,
}: {
  item: GenerationRecordMediaItem;
  className?: string;
  showPlayBadge?: boolean;
}) {
  if (item.kind === "video") {
    return (
      <div className={cn("relative overflow-hidden bg-black/40", className)}>
        <video
          src={item.url}
          className="size-full object-cover object-center"
          muted
          playsInline
          preload="metadata"
        />
        {showPlayBadge ? (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
            <span className="flex size-5 items-center justify-center rounded-full bg-black/55 ring-1 ring-white/20">
              <Play className="ml-0.5 size-2.5 fill-white text-white" />
            </span>
          </span>
        ) : null}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt=""
      className={cn("size-full object-cover", className)}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

function GenerationRecordHoverPreview({
  media,
  index,
  title,
  anchorRect,
  onIndexChange,
  onMouseEnter,
  onMouseLeave,
}: {
  media: GenerationRecordMediaItem[];
  index: number;
  title: string;
  anchorRect: DOMRect;
  onIndexChange: (next: number) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const previewW = 340;
  const previewH = 420;
  const { left, top } = computePreviewPosition(anchorRect, previewW, previewH);
  const current = media[index] ?? media[0];
  if (!current) return null;

  const goPrev = () =>
    onIndexChange((index - 1 + media.length) % media.length);
  const goNext = () => onIndexChange((index + 1) % media.length);

  return createPortal(
    <div
      className="fixed z-[1500]"
      style={{ left, top, width: previewW, height: previewH }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/15 bg-[#0c0c12] shadow-[0_20px_60px_rgba(0,0,0,0.65)] ring-1 ring-cyan-400/20">
        <div className="relative min-h-0 flex-1 bg-black/50">
          {current.kind === "video" ? (
            <video
              key={current.url}
              src={current.url}
              className="size-full object-contain"
              muted
              playsInline
              autoPlay
              loop
              controls
              preload="metadata"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={current.url}
              src={current.url}
              alt=""
              className="size-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          {media.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="上一张"
                className="absolute left-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
                onClick={goPrev}
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="下一张"
                className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80"
                onClick={goNext}
              >
                <ChevronRight className="size-4" />
              </button>
            </>
          ) : null}
        </div>

        {media.length > 1 ? (
          <div className="flex shrink-0 gap-1 overflow-x-auto border-t border-white/10 bg-black/35 p-1.5">
            {media.map((m, i) => (
              <button
                key={`${m.url}-${i}`}
                type="button"
                aria-label={m.label}
                title={m.label}
                className={cn(
                  "relative size-11 shrink-0 overflow-hidden rounded-md border transition",
                  i === index
                    ? "border-cyan-400/70 ring-1 ring-cyan-400/40"
                    : "border-white/10 opacity-75 hover:opacity-100",
                )}
                onClick={() => onIndexChange(i)}
              >
                <MediaTile item={m} showPlayBadge={m.kind === "video"} />
              </button>
            ))}
          </div>
        ) : null}

        <div className="shrink-0 border-t border-white/10 px-2.5 py-1.5">
          <p className="truncate text-[11px] text-white/80">
            {current.label}
            {media.length > 1 ? (
              <span className="text-white/45"> · {index + 1}/{media.length}</span>
            ) : null}
          </p>
          <p className="truncate text-[10px] text-white/45">{title}</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function GenerationRecordMediaPreview({
  item,
  title,
}: {
  item: CanvasGenerationRecord;
  title: string;
}) {
  const media = useMemo(() => resolveGenerationRecordMedia(item), [item]);
  const anchorRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const refreshAnchor = useCallback(() => {
    if (anchorRef.current) {
      setAnchorRect(anchorRef.current.getBoundingClientRect());
    }
  }, []);

  const showAt = useCallback(
    (idx: number) => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      setIndex(idx);
      refreshAnchor();
      setOpen(true);
    },
    [refreshAnchor],
  );

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      hideTimerRef.current = null;
    }, 160);
  }, []);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => setOpen(false);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  if (!media.length) return null;

  const shown = media.slice(0, 4);
  const extra = media.length - shown.length;

  return (
    <>
      <div
        ref={anchorRef}
        className="relative size-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50"
        onMouseEnter={() => showAt(index)}
        onMouseLeave={scheduleHide}
      >
        {media.length === 1 ? (
          <MediaTile item={media[0]!} className="size-full" showPlayBadge />
        ) : (
          <div className="grid size-full grid-cols-2 grid-rows-2 gap-px bg-white/10">
            {shown.map((m, i) => (
              <button
                key={`${m.url}-${i}`}
                type="button"
                className="relative min-h-0 min-w-0 overflow-hidden bg-black/40"
                aria-label={m.label}
                onMouseEnter={() => showAt(i)}
              >
                <MediaTile item={m} showPlayBadge={m.kind === "video"} />
                {extra > 0 && i === shown.length - 1 ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-[10px] font-medium text-white">
                    +{extra}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </div>

      {open && anchorRect ? (
        <GenerationRecordHoverPreview
          media={media}
          index={index}
          title={title}
          anchorRect={anchorRect}
          onIndexChange={setIndex}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      ) : null}
    </>
  );
}
