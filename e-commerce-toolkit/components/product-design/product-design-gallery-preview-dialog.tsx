"use client";

import { Download } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ProductDesignGalleryPreviewItem = {
  url: string;
  title: string;
  ratio?: string;
  downloadFilename?: string;
};

function cssAspectRatio(ratio?: string): string | undefined {
  if (!ratio || ratio === "natural" || ratio === "auto") return undefined;
  switch (ratio) {
    case "3:4":
      return "3 / 4";
    case "4:5":
      return "4 / 5";
    case "16:9":
      return "16 / 9";
    case "9:16":
      return "9 / 16";
    default:
      return "1 / 1";
  }
}

function downloadImageFile(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.replace(/[^\w\u4e00-\u9fff.-]+/g, "_");
  a.rel = "noopener";
  a.target = "_blank";
  a.click();
}

export function ProductDesignGalleryPreviewDialog({
  items,
  initialIndex = 0,
  open,
  onOpenChange,
}: {
  items: ProductDesignGalleryPreviewItem[];
  initialIndex?: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) setActiveIndex(initialIndex);
  }, [open, initialIndex]);

  const active = items[activeIndex] ?? items[0];

  const goPrev = useCallback(() => {
    if (items.length <= 1) return;
    setActiveIndex((i) => (i <= 0 ? items.length - 1 : i - 1));
  }, [items.length]);

  const goNext = useCallback(() => {
    if (items.length <= 1) return;
    setActiveIndex((i) => (i >= items.length - 1 ? 0 : i + 1));
  }, [items.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, goPrev, goNext]);

  if (!active) return null;

  const aspectRatio = cssAspectRatio(active.ratio);
  const close = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 border-0 bg-black/95 p-0 text-white",
          "translate-x-[-50%] translate-y-[-50%]",
          "[&>button]:text-white/80 [&>button]:opacity-90 [&>button]:hover:opacity-100",
        )}
        onClick={close}
      >
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium text-white">
            {active.title}
            {items.length > 1 ? (
              <span className="ml-2 text-xs font-normal text-white/60">
                {activeIndex + 1} / {items.length}
              </span>
            ) : null}
          </DialogTitle>
          <button
            type="button"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/20 px-2.5 text-[11px] text-white/90 hover:bg-white/10"
            onClick={(e) => {
              e.stopPropagation();
              downloadImageFile(
                active.url,
                active.downloadFilename ?? active.title,
              );
            }}
          >
            <Download className="h-3.5 w-3.5" />
            下载
          </button>
        </DialogHeader>
        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
            <div
              className={cn(
                "relative max-h-full max-w-full overflow-hidden rounded-lg bg-black",
                !aspectRatio && "w-full",
              )}
              style={aspectRatio ? { aspectRatio } : undefined}
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={active.url}
                alt={active.title}
                className={
                  aspectRatio
                    ? "h-full w-full max-h-[calc(100dvh-5rem)] object-contain"
                    : "mx-auto block h-auto max-h-[calc(100dvh-5rem)] w-auto max-w-full object-contain"
                }
              />
            </div>
          </div>
          {items.length > 1 ? (
            <aside className="ecom-scrollbar-thin flex w-[5.5rem] shrink-0 flex-col gap-2 overflow-y-auto border-l border-white/10 p-2 sm:w-[6.5rem]">
              {items.map((item, i) => (
                <button
                  key={`${item.url}-${i}`}
                  type="button"
                  title={item.title}
                  className={cn(
                    "relative aspect-square w-full shrink-0 overflow-hidden rounded-lg border-2 bg-black/40 transition",
                    i === activeIndex
                      ? "border-white"
                      : "border-transparent opacity-70 hover:opacity-100",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(i);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt={item.title}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </aside>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
