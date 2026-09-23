"use client";

import {
  EcomCopyOverlayCanvas,
  EcomCopyOverlayLayerControls,
  resolveOverlayForEditor,
  syncOverlayMainLayerText,
  type EcomCopyOverlay,
} from "@private/ecom-copy-overlay";
import { useEffect, useMemo, useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { detailPageAspectClass } from "@/lib/detail-page-suite-platform-ratio";
import type { EcomDetailPageRatio } from "@/lib/detail-page-suite-platform-ratio";

export type DetailPageSuiteSlotPromptSaveExtras = {
  slotCopy?: string;
  copyOverlay?: EcomCopyOverlay;
  burnCopyInImage?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  prompt: string;
  shootingRequirement?: string;
  mode?: "edit" | "add";
  saving?: boolean;
  composing?: boolean;
  onSave: (prompt: string, extras?: DetailPageSuiteSlotPromptSaveExtras) => void | Promise<void>;
  onCompose?: (
    prompt: string,
    extras: DetailPageSuiteSlotPromptSaveExtras,
  ) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteBusy?: boolean;
  slotCopy?: string;
  slotCopyAi?: string;
  showSlotCopyField?: boolean;
  baseImageUrl?: string | null;
  copyOverlay?: EcomCopyOverlay | null;
  exportWidthPx?: number;
  displayRatio?: EcomDetailPageRatio;
};

const promptTextareaClass =
  "mt-1 w-full min-h-[7rem] max-h-[min(16rem,28vh)] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] focus:ring-0";

/** 详情页套图 · 单点位编辑（左图排版 + 右文案/提示词） */
export function DetailPageSuiteSlotPromptEditDialog({
  open,
  onOpenChange,
  title,
  prompt,
  shootingRequirement,
  mode = "edit",
  saving = false,
  composing = false,
  onSave,
  onCompose,
  onRewrite,
  rewriteBusy = false,
  slotCopy = "",
  slotCopyAi = "",
  showSlotCopyField = false,
  baseImageUrl = null,
  copyOverlay = null,
  exportWidthPx = 750,
  displayRatio = "3:4",
}: Props) {
  const isAdd = mode === "add";
  const layoutMode = showSlotCopyField && !isAdd;
  const [draft, setDraft] = useState(prompt);
  const [copyDraft, setCopyDraft] = useState(slotCopy);
  const [overlay, setOverlay] = useState<EcomCopyOverlay>(() =>
    resolveOverlayForEditor({
      overlay: copyOverlay,
      text: slotCopy,
      exportWidthPx,
      baseImageUrl: baseImageUrl ?? undefined,
    }),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("main");

  const aiCopy = slotCopyAi.trim();
  const selectedLayer = overlay.layers.find((l) => l.id === selectedLayerId) ?? overlay.layers[0];

  useEffect(() => {
    if (open) {
      setDraft(prompt);
      setCopyDraft(slotCopy);
      setOverlay(
        resolveOverlayForEditor({
          overlay: copyOverlay,
          text: slotCopy,
          exportWidthPx,
          baseImageUrl: baseImageUrl ?? undefined,
        }),
      );
      setSelectedLayerId("main");
    }
  }, [open, prompt, slotCopy, copyOverlay, exportWidthPx, baseImageUrl]);

  useEffect(() => {
    if (!open || !layoutMode) return;
    setOverlay((prev) => syncOverlayMainLayerText(prev, copyDraft));
  }, [copyDraft, layoutMode, open]);

  const saveExtras = useMemo(
    (): DetailPageSuiteSlotPromptSaveExtras => ({
      slotCopy: copyDraft.trim(),
      copyOverlay: overlay,
      burnCopyInImage: false,
    }),
    [copyDraft, overlay],
  );

  const busy = saving || composing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          layoutMode
            ? "flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0"
            : "flex max-h-[80vh] max-w-2xl flex-col gap-0 overflow-hidden p-0"
        }
      >
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="leading-snug">
              {isAdd ? title : layoutMode ? `${title} · 排版与出图` : `${title} · 出图提示词`}
            </DialogTitle>
          </DialogHeader>
          <div
            className={
              layoutMode
                ? "mt-4 flex min-h-0 flex-col gap-4 pb-2 lg:flex-row lg:items-start"
                : "mt-4 space-y-4 pb-2"
            }
          >
            {layoutMode ? (
              <div className="min-w-0 shrink-0 lg:w-[340px]">
                <p className="mb-2 text-xs text-[#86868b]">
                  拖拽文字定位 · 导出宽 {overlay.exportWidthPx}px
                </p>
                <EcomCopyOverlayCanvas
                  baseImageUrl={baseImageUrl}
                  aspectClassName={detailPageAspectClass(displayRatio)}
                  overlay={overlay}
                  onChange={setOverlay}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={setSelectedLayerId}
                  emptyHint="请先出无字底图，再在此拖拽排版"
                />
                <EcomCopyOverlayLayerControls
                  overlay={overlay}
                  selectedLayer={selectedLayer}
                  onChange={setOverlay}
                  className="mt-3"
                />
              </div>
            ) : null}

            <div className={layoutMode ? "min-w-0 flex-1 space-y-4" : "space-y-4"}>
              {!isAdd && shootingRequirement?.trim() ? (
                <div className="rounded-lg border border-[#e8e8ed] bg-[#f5f5f7] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f]">
                  <span className="font-medium text-[#6e6e73]">拍摄要求：</span>
                  {shootingRequirement.trim()}
                </div>
              ) : null}
              {showSlotCopyField && !isAdd ? (
                <div className="space-y-2">
                  <label className="block text-sm text-[#6e6e73]">
                    模块文案
                    <textarea
                      className="mt-1 min-h-[88px] max-h-[min(8rem,18vh)] w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245]"
                      value={copyDraft}
                      onChange={(e) => setCopyDraft(e.target.value)}
                      placeholder={
                        aiCopy
                          ? undefined
                          : "尚未生成文案；可点「AI 重写本条」或先在左侧生成原创文案"
                      }
                    />
                  </label>
                  {aiCopy ? (
                    <EcomButtonSecondary
                      type="button"
                      size="sm"
                      disabled={busy}
                      onClick={() => setCopyDraft(aiCopy)}
                    >
                      恢复 AI 文案
                    </EcomButtonSecondary>
                  ) : null}
                  <p className="text-xs leading-relaxed text-[#86868b]">
                    程序排版合成（与画布烧字共用引擎）；出图请用无字底图后再点「合成并保存新版」。
                  </p>
                </div>
              ) : null}
              <label className="block text-sm text-[#6e6e73]">
                {isAdd
                  ? "填写出图提示词，保存后新增 1 个点位格"
                  : showSlotCopyField
                    ? "出图提示词（无字摄影画面）"
                    : "下方为完整出图提示词（含全片约束与本张拍摄要求），修改后保存将同步至中栏点位卡"}
                <textarea
                  className={
                    showSlotCopyField || isAdd
                      ? promptTextareaClass
                      : `${promptTextareaClass} max-h-[min(22rem,42vh)] min-h-[12rem]`
                  }
                  value={draft}
                  autoFocus={!layoutMode && !showSlotCopyField}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="中文生图描述…"
                />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-[#e8e8ed] px-6 py-4 sm:justify-end">
          {!isAdd && onRewrite ? (
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={busy || rewriteBusy}
              onClick={onRewrite}
            >
              {rewriteBusy ? "AI 生成中…" : "AI 重写本条（文案+提示词）"}
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            取消
          </EcomButtonSecondary>
          {layoutMode && onCompose ? (
            <EcomButtonPrimary
              type="button"
              size="sm"
              disabled={busy || !baseImageUrl || !copyDraft.trim()}
              onClick={() => void onCompose(draft.trim(), saveExtras)}
            >
              {composing ? "合成中…" : "合成并保存新版"}
            </EcomButtonPrimary>
          ) : null}
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || !draft.trim()}
            onClick={() => void onSave(draft.trim(), showSlotCopyField ? saveExtras : undefined)}
          >
            {saving ? "保存中…" : isAdd ? "添加点位" : "保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
