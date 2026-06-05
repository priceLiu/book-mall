"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function EcomImagePreviewDialog({
  src,
  open,
  onOpenChange,
  title = "图片预览",
}: {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
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
