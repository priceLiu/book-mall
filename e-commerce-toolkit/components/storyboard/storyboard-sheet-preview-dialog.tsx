"use client";

import { EcomFullScreenOverlay } from "@/components/ui/ecom-full-screen-overlay";
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
  panelAspectRatio?: "16:9" | "9:16";
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
  panelAspectRatio = "9:16",
}: Props) {
  return (
    <EcomFullScreenOverlay
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      zIndexClass="z-[350]"
      panelClassName="h-[92vh] max-h-[92vh] w-[min(98vw,1400px)]"
    >
      <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-auto rounded-lg border border-[#e8e8ed] bg-white p-2">
        <StoryboardProSheetView
          sheet={sheet}
          references={references}
          productName={productName}
          productHighlight={productHighlight}
          projectKeywords={projectKeywords}
          producer={producer}
          sheetHeading={sheetHeading}
          panelAspectRatio={panelAspectRatio}
          exportRootId="storyboard-sheet-preview"
          variant="preview"
        />
      </div>
    </EcomFullScreenOverlay>
  );
}
