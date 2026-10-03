"use client";

import {
  EcomCopyOverlayCanvas,
  EcomCopyOverlayLayerControls,
  resolveOverlayForEditor,
  syncOverlayMainLayerText,
  type EcomCopyOverlay,
} from "@private/ecom-copy-overlay";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const promptTextareaClass =
  "mt-1 w-full min-h-[7rem] max-h-[min(16rem,28vh)] resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245] focus:ring-0";

export type EcomCopyLayoutStudioSaveExtras = {
  slotCopy?: string;
  copyOverlay?: EcomCopyOverlay;
  burnCopyInImage?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  baseImageUrl: string | null;
  imagePrompt: string;
  slotCopy?: string;
  slotCopyAi?: string;
  copyOverlay?: EcomCopyOverlay | null;
  exportWidthPx?: number;
  aspectClassName?: string;
  saving?: boolean;
  composing?: boolean;
  rewriteBusy?: boolean;
  onSave: (imagePrompt: string, extras?: EcomCopyLayoutStudioSaveExtras) => void | Promise<void>;
  onCompose?: (
    imagePrompt: string,
    extras: EcomCopyLayoutStudioSaveExtras,
  ) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteButtonLabel?: string;
  composeHint?: string;
  /** 详情页套图：拍摄要求、本格参考图等 */
  rightColumnExtras?: ReactNode;
};

/** 程序排版 · 排版与出图（详情页套图 / 营销海报 / 画布共用壳层） */
export function EcomCopyLayoutStudioDialog({
  open,
  onOpenChange,
  title,
  baseImageUrl,
  imagePrompt,
  slotCopy = "",
  slotCopyAi = "",
  copyOverlay = null,
  exportWidthPx = 750,
  aspectClassName = "aspect-[3/4]",
  saving = false,
  composing = false,
  rewriteBusy = false,
  onSave,
  onCompose,
  onRewrite,
  rewriteButtonLabel = "AI 重写本条（文案+提示词）",
  composeHint = "程序排版合成（与画布烧字共用引擎）；出图请用无字底图后再点「合成并保存新版」。",
  rightColumnExtras,
}: Props) {
  const [promptDraft, setPromptDraft] = useState(imagePrompt);
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
  const busy = saving || composing;

  useEffect(() => {
    if (open) {
      setPromptDraft(imagePrompt);
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
  }, [open, imagePrompt, slotCopy, copyOverlay, exportWidthPx, baseImageUrl]);

  useEffect(() => {
    if (!open) return;
    setOverlay((prev) => syncOverlayMainLayerText(prev, copyDraft));
  }, [copyDraft, open]);

  const saveExtras = useMemo(
    (): EcomCopyLayoutStudioSaveExtras => ({
      slotCopy: copyDraft.trim(),
      copyOverlay: overlay,
      burnCopyInImage: false,
    }),
    [copyDraft, overlay],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 pt-6">
          <DialogHeader className="pr-10">
            <DialogTitle className="leading-snug">{title} · 排版与出图</DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex min-h-0 flex-col gap-4 pb-2 lg:flex-row lg:items-start">
            <div className="min-w-0 shrink-0 lg:w-[340px]">
              <p className="mb-2 text-xs text-[#86868b]">
                拖拽文字定位 · 导出宽 {overlay.exportWidthPx}px
              </p>
              <EcomCopyOverlayCanvas
                baseImageUrl={baseImageUrl}
                aspectClassName={aspectClassName}
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
            <div className="min-w-0 flex-1 space-y-4">
              <div className="space-y-2">
                <label className="block text-sm text-[#6e6e73]">
                  模块文案
                  <textarea
                    className="mt-1 min-h-[88px] max-h-[min(8rem,18vh)] w-full resize-y rounded-lg border border-[#d2d2d7] bg-white px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#424245]"
                    value={copyDraft}
                    onChange={(e) => setCopyDraft(e.target.value)}
                    placeholder={
                      aiCopy ? undefined : "填写标题/卖点；可点「恢复 AI 文案」"
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
                <p className="text-xs leading-relaxed text-[#86868b]">{composeHint}</p>
              </div>
              {rightColumnExtras}
              <label className="block text-sm text-[#6e6e73]">
                出图提示词（无字摄影画面）
                <textarea
                  className={promptTextareaClass}
                  value={promptDraft}
                  onChange={(e) => setPromptDraft(e.target.value)}
                  placeholder="中文生图描述…"
                />
              </label>
            </div>
          </div>
        </div>
        <DialogFooter className="shrink-0 flex-wrap gap-2 border-t border-[#e8e8ed] px-6 py-4 sm:justify-end">
          {onRewrite ? (
            <EcomButtonSecondary
              type="button"
              size="sm"
              disabled={busy || rewriteBusy}
              onClick={onRewrite}
            >
              {rewriteBusy ? "AI 生成中…" : rewriteButtonLabel}
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
            取消
          </EcomButtonSecondary>
          {onCompose ? (
            <EcomButtonPrimary
              type="button"
              size="sm"
              disabled={busy || !baseImageUrl || !copyDraft.trim()}
              onClick={() => void onCompose(promptDraft.trim(), saveExtras)}
            >
              {composing ? "合成中…" : "合成并保存新版"}
            </EcomButtonPrimary>
          ) : null}
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || !promptDraft.trim()}
            onClick={() => void onSave(promptDraft.trim(), saveExtras)}
          >
            {saving ? "保存中…" : "保存"}
          </EcomButtonPrimary>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
