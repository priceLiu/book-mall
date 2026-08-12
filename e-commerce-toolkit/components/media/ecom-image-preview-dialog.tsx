"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function cssAspectRatio(ratio?: string): string {
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

export function EcomImagePreviewDialog({
  src,
  open,
  onOpenChange,
  title = "图片预览",
  aspectRatio,
  objectFit = "contain",
  fullscreen = false,
}: {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** 按平台比例全屏预览（如 1:1、3:4） */
  aspectRatio?: string;
  /** 有 aspectRatio 时可 cover 铺满画框 */
  objectFit?: "cover" | "contain";
  fullscreen?: boolean;
}) {
  const fitClass = objectFit === "cover" ? "object-cover object-center" : "object-contain";

  if (fullscreen) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "flex h-[100dvh] max-h-[100dvh] w-[100vw] max-w-[100vw] flex-col gap-0 border-0 bg-black/95 p-0 text-white",
            "translate-x-[-50%] translate-y-[-50%]",
          )}
        >
          <DialogHeader className="shrink-0 border-b border-white/10 px-4 py-3">
            <DialogTitle className="text-sm font-medium text-white">{title}</DialogTitle>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 items-center justify-center p-4 sm:p-8">
            <div
              className="relative max-h-full max-w-full overflow-hidden rounded-lg bg-black"
              style={{ aspectRatio: cssAspectRatio(aspectRatio) }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={title}
                className={cn(
                  "h-full w-full max-h-[calc(100dvh-5rem)]",
                  fitClass,
                )}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="relative max-h-[80vh] w-full overflow-auto rounded-lg bg-[#f5f5f7]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={title}
            className="mx-auto h-auto w-full object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
