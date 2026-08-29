"use client";

import { Loader2 } from "lucide-react";

import { StoryboardProSheetView } from "@/components/storyboard/storyboard-pro-sheet-view";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";

type Props = {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  activeImageGenPanels: ReadonlySet<number>;
  imgBusy?: boolean;
  onGeneratePanel: (panelIndex: number) => void;
  onGenerateAll: () => void;
  onOpenSheetPreview?: () => void;
  onPreviewImage?: (src: string, title: string) => void;
};

/**
 * 服装路径 B · 故事版工作区：复用微剧 StoryboardProSheetView，
 * 整页展示参考图 + 各镜脚本/提示词/分镜图，与「分镜脚本表」分离。
 */
export function FashionStoryboardSheetWorkspace({
  sheet,
  references,
  productName,
  productHighlight,
  projectKeywords,
  activeImageGenPanels,
  imgBusy = false,
  onGeneratePanel,
  onGenerateAll,
  onOpenSheetPreview,
  onPreviewImage,
}: Props) {
  const busy = imgBusy || activeImageGenPanels.size > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-[#6e6e73]">
          故事版为整页分镜：产品信息、参考图、各镜画面与口播在同一版式。点击镜头位「生成分镜图」，或一键生成全部。
        </p>
        <div className="flex flex-wrap gap-2">
          {onOpenSheetPreview ? (
            <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onOpenSheetPreview}>
              放大预览
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy}
            onClick={onGenerateAll}
          >
            {busy ? (
              <>
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                生成中…
              </>
            ) : (
              "生成全部分镜图"
            )}
          </EcomButtonPrimary>
        </div>
      </div>

      <div className="ecom-scrollbar-thin overflow-x-auto rounded-xl border border-[#e8e8ed] bg-white p-2">
        <StoryboardProSheetView
          sheet={sheet}
          references={references}
          productName={productName}
          productHighlight={productHighlight}
          projectKeywords={projectKeywords}
          sheetHeading="服装专业版分镜故事版"
          exportRootId="fashion-storyboard-sheet-workspace"
          variant="preview"
          interactive
          generatingPanelIndexes={activeImageGenPanels}
          onGeneratePanel={onGeneratePanel}
          onPreviewImage={onPreviewImage}
        />
      </div>
    </div>
  );
}
