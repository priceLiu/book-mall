"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EcomVideoPlayer } from "@/components/media/ecom-video-player";

export function EcomVideoPreviewDialog({
  src,
  open,
  onOpenChange,
  title = "视频预览",
}: {
  src: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-3">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <EcomVideoPlayer src={src} autoPlay className="w-full" />
      </DialogContent>
    </Dialog>
  );
}
