"use client";

import { useState } from "react";

import { EcomImagePreviewDialog } from "@/components/media/ecom-image-preview-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StoryboardProSheetView } from "@/components/storyboard/storyboard-pro-sheet-view";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  producer?: string;
  title?: string;
};

/** 完整分镜图预览：各镜头/参考图可点击放大 */
export function StoryboardSheetPreviewDialog({
  open,
  onOpenChange,
  sheet,
  references,
  productName,
  productHighlight,
  projectKeywords,
  producer,
  title = "完整分镜图",
}: Props) {
  const [imagePreview, setImagePreview] = useState<{
    src: string;
    title: string;
  } | null>(null);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col gap-3 overflow-hidden p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-[#86868b]">点击任意镜头或参考图可放大预览</p>
          <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-auto rounded-lg border border-[#e8e8ed] bg-white p-2">
            <StoryboardProSheetView
              sheet={sheet}
              references={references}
              productName={productName}
              productHighlight={productHighlight}
              projectKeywords={projectKeywords}
              producer={producer}
              exportRootId="storyboard-sheet-preview"
              variant="preview"
              onPreviewImage={(src, imgTitle) =>
                setImagePreview({ src, title: imgTitle })
              }
            />
          </div>
        </DialogContent>
      </Dialog>

      {imagePreview ? (
        <EcomImagePreviewDialog
          src={imagePreview.src}
          open
          onOpenChange={(next) => {
            if (!next) setImagePreview(null);
          }}
          title={imagePreview.title}
        />
      ) : null}
    </>
  );
}
