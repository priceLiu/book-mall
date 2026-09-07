"use client";

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
  sheetHeading?: string;
  sheetPngUrl?: string | null;
};

/** 完整分镜图预览：可滚动查看整表（成片区左栏「预览」入口） */
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
  sheetHeading,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[min(98vw,1400px)] max-w-[98vw] flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-auto rounded-lg border border-[#e8e8ed] bg-white p-2">
          <StoryboardProSheetView
            sheet={sheet}
            references={references}
            productName={productName}
            productHighlight={productHighlight}
            projectKeywords={projectKeywords}
            producer={producer}
            sheetHeading={sheetHeading}
            exportRootId="storyboard-sheet-preview"
            variant="preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
