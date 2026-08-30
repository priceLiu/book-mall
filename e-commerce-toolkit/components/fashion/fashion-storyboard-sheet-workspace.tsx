"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { StoryboardProSheetView } from "@/components/storyboard/storyboard-pro-sheet-view";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import type { StoryboardReference, StoryboardSheet } from "@/lib/storyboard-types";

export type FashionCharacterRefMode = "ai" | "upload";

type Props = {
  sheet: StoryboardSheet;
  references: StoryboardReference[];
  productName?: string;
  productHighlight?: string;
  projectKeywords?: string;
  activeImageGenPanels: ReadonlySet<number>;
  imgBusy?: boolean;
  submitBusy?: boolean;
  charGenBusy?: boolean;
  characterMode?: FashionCharacterRefMode;
  hasCharacterRef?: boolean;
  setupReady?: boolean;
  allPanelsHaveImages?: boolean;
  onCharacterModeChange: (mode: FashionCharacterRefMode) => void;
  onGeneratePanel: (panelIndex: number) => void;
  onGenerateSelected: (panelIndexes: number[]) => void;
  onGenerateAll: () => void;
  onClearPanelImages: () => void;
  onSubmitStoryboard?: () => void;
  onResyncSheet?: () => void;
  resyncBusy?: boolean;
  onOpenSheetPreview?: () => void;
  onPreviewImage?: (src: string, title: string) => void;
  onPreviewPanelPrompt?: (panelIndex: number) => void;
  sheetHeading?: string;
};

/**
 * 服装路径 B · 故事版工作区：整页分镜 + 成片设置 + 打勾选镜生图。
 */
export function FashionStoryboardSheetWorkspace({
  sheet,
  references,
  productName,
  productHighlight,
  projectKeywords,
  activeImageGenPanels,
  imgBusy = false,
  submitBusy = false,
  charGenBusy = false,
  characterMode,
  hasCharacterRef = false,
  setupReady = false,
  allPanelsHaveImages = false,
  onCharacterModeChange,
  onGeneratePanel,
  onGenerateSelected,
  onGenerateAll,
  onClearPanelImages,
  onSubmitStoryboard,
  onResyncSheet,
  resyncBusy = false,
  onOpenSheetPreview,
  onPreviewImage,
  onPreviewPanelPrompt,
  sheetHeading = "服装专业版分镜故事版",
}: Props) {
  const [selectedPanels, setSelectedPanels] = useState<Set<number>>(() => new Set());
  const busy = imgBusy || activeImageGenPanels.size > 0 || submitBusy || resyncBusy || charGenBusy;

  const togglePanel = useCallback((panelIndex: number) => {
    setSelectedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelIndex)) next.delete(panelIndex);
      else next.add(panelIndex);
      return next;
    });
  }, []);

  const selectedList = useMemo(
    () => [...selectedPanels].sort((a, b) => a - b),
    [selectedPanels],
  );

  const charModeLabel =
    characterMode === "ai"
      ? "AI 生成角色"
      : characterMode === "upload"
        ? hasCharacterRef
          ? "已上传角色图"
          : "上传角色图（待上传）"
        : "未选择";

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3">
        <p className="text-xs font-semibold text-[#1d1d1f]">成片设置（生图前必选）</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy}
            className={characterMode === "ai" ? "bg-[#f0f6ff]" : undefined}
            onClick={() => onCharacterModeChange("ai")}
          >
            {charGenBusy ? (
              <>
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                AI 生成中…
              </>
            ) : (
              "AI 生成角色"
            )}
          </EcomButtonSecondary>
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy}
            className={characterMode === "upload" ? "bg-[#f0f6ff]" : undefined}
            onClick={() => onCharacterModeChange("upload")}
          >
            上传角色图
          </EcomButtonSecondary>
          {onResyncSheet ? (
            <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onResyncSheet}>
              {resyncBusy ? "同步中…" : "重新同步故事版"}
            </EcomButtonSecondary>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-[#6e6e73]">
          当前：角色 {charModeLabel}。
          {!setupReady
            ? " 点击「生成分镜图」时会先选择角色参考方式，再选择生图模型。"
            : " 可勾选镜头单独生成，或一键生成全部；每次生成前会弹出模型选择。"}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-[#6e6e73]">
          各镜下方为分镜脚本；勾选后可「生成选中镜」。
        </p>
        <div className="flex flex-wrap gap-2">
          {onOpenSheetPreview ? (
            <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onOpenSheetPreview}>
              放大预览
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy || selectedList.length === 0}
            onClick={() => {
              const indexes = selectedList;
              setSelectedPanels(new Set());
              onGenerateSelected(indexes);
            }}
          >
            生成选中镜{selectedList.length > 0 ? `（${selectedList.length}）` : ""}
          </EcomButtonSecondary>
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => {
              setSelectedPanels(new Set());
              onGenerateAll();
            }}
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
          <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onClearPanelImages}>
            清空分镜图
          </EcomButtonSecondary>
          {onSubmitStoryboard ? (
            <EcomButtonPrimary
              type="button"
              size="sm"
              disabled={busy || !allPanelsHaveImages}
              onClick={onSubmitStoryboard}
            >
              {submitBusy ? "提交中…" : "生成故事版并提交"}
            </EcomButtonPrimary>
          ) : null}
        </div>
      </div>

      <div className="ecom-scrollbar-thin overflow-x-auto rounded-xl border border-[#e8e8ed] bg-white p-2">
        <StoryboardProSheetView
          sheet={sheet}
          references={references}
          productName={productName}
          productHighlight={productHighlight}
          projectKeywords={projectKeywords}
          sheetHeading={sheetHeading}
          exportRootId="fashion-storyboard-sheet-workspace"
          variant="preview"
          interactive
          generatingPanelIndexes={activeImageGenPanels}
          selectedPanelIndexes={selectedPanels}
          onTogglePanelSelect={togglePanel}
          onGeneratePanel={onGeneratePanel}
          onRegeneratePanel={onGeneratePanel}
          onPreviewPanelPrompt={onPreviewPanelPrompt}
          onPreviewImage={onPreviewImage}
        />
      </div>
    </div>
  );
}
