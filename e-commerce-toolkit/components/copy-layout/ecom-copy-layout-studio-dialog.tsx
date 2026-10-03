"use client";

import {
  EcomCopyOverlayCanvas,
  EcomCopyOverlayLayerControls,
  EcomCopyOverlayLayersEditor,
  overlayHasAnyCopy,
  primarySlotCopyFromOverlay,
  patchOverlayLayerText,
  resolveOverlayForEditor,
  type EcomCopyOverlay,
  type EcomCopyOverlayCanvasHandle,
} from "@private/ecom-copy-overlay";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const promptTextareaClass =
  "mt-1.5 w-full min-h-[5.5rem] max-h-[min(12rem,22vh)] resize-y rounded-lg border border-[#d2d2d7] bg-[#fafafa] px-3 py-2 text-sm leading-relaxed text-[#1d1d1f] outline-none focus:border-[#0071e3] focus:bg-white focus:ring-1 focus:ring-[#0071e3]/20";

export type EcomCopyLayoutStudioSaveExtras = {
  slotCopy?: string;
  copyOverlay?: EcomCopyOverlay;
  burnCopyInImage?: boolean;
};

export type EcomCopyLayoutStudioPreviewResult = {
  previewUrl: string;
};

type WorkbenchView = "edit" | "preview";

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
  previewing?: boolean;
  rewriteBusy?: boolean;
  onSave: (imagePrompt: string, extras?: EcomCopyLayoutStudioSaveExtras) => void | Promise<void>;
  onPreview?: (
    imagePrompt: string,
    extras: EcomCopyLayoutStudioSaveExtras,
  ) => void | Promise<EcomCopyLayoutStudioPreviewResult | void>;
  onConfirmCompose?: (
    imagePrompt: string,
    extras: EcomCopyLayoutStudioSaveExtras,
    ctx: { previewUrl: string },
  ) => void | Promise<void>;
  onCompose?: (
    imagePrompt: string,
    extras: EcomCopyLayoutStudioSaveExtras,
  ) => void | Promise<void>;
  onRewrite?: () => void;
  rewriteButtonLabel?: string;
  composeHint?: string;
  rightColumnExtras?: ReactNode;
};

function InspectorSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-[#e8e8ed] bg-white p-4 shadow-sm",
        className,
      )}
    >
      <h3 className="text-sm font-semibold text-[#1d1d1f]">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-xs leading-relaxed text-[#86868b]">{description}</p>
      ) : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function WorkbenchToggle({
  view,
  onChange,
  previewReady,
}: {
  view: WorkbenchView;
  onChange: (v: WorkbenchView) => void;
  previewReady: boolean;
}) {
  return (
    <div className="inline-flex rounded-full border border-[#d2d2d7] bg-[#fafafa] p-0.5">
      {(
        [
          { id: "edit" as const, label: "编辑排版" },
          { id: "preview" as const, label: "合成预览" },
        ] as const
      ).map((tab) => {
        const disabled = tab.id === "preview" && !previewReady;
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            disabled={disabled}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-white text-[#1d1d1f] shadow-sm"
                : "text-[#6e6e73] hover:text-[#1d1d1f]",
              disabled && "cursor-not-allowed opacity-40",
            )}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** 程序排版 · 全屏多文案块（详情页套图 / 营销海报） */
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
  previewing = false,
  rewriteBusy = false,
  onSave,
  onPreview,
  onConfirmCompose,
  onCompose,
  onRewrite,
  rewriteButtonLabel = "AI 重写本条（文案+提示词）",
  composeHint,
  rightColumnExtras,
}: Props) {
  const [promptDraft, setPromptDraft] = useState(imagePrompt);
  const [overlay, setOverlay] = useState<EcomCopyOverlay>(() =>
    resolveOverlayForEditor({
      overlay: copyOverlay,
      text: slotCopy,
      exportWidthPx,
      baseImageUrl: baseImageUrl ?? undefined,
    }),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("main");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewStale, setPreviewStale] = useState(false);
  const [localPreviewBusy, setLocalPreviewBusy] = useState(false);
  const [workbenchView, setWorkbenchView] = useState<WorkbenchView>("edit");
  const canvasRef = useRef<EcomCopyOverlayCanvasHandle>(null);

  const aiCopy = slotCopyAi.trim();
  const selectedLayer = overlay.layers.find((l) => l.id === selectedLayerId) ?? overlay.layers[0];
  const twoStepCompose = Boolean(onPreview);
  const previewBusy = previewing || localPreviewBusy;
  const busy = saving || composing || previewBusy;
  const hint =
    composeHint ??
    (twoStepCompose
      ? "生成预览核对成图，满意后保存并关闭。"
      : "拖拽定位文案，保存后外层自动刷新。");

  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = resolveOverlayForEditor({
        overlay: copyOverlay,
        text: slotCopy,
        exportWidthPx,
        baseImageUrl: baseImageUrl ?? undefined,
      });
      setPromptDraft(imagePrompt);
      setOverlay(next);
      setSelectedLayerId(next.layers[0]?.id ?? "main");
      setPreviewUrl(null);
      setPreviewStale(false);
      setWorkbenchView("edit");
    }
    wasOpenRef.current = open;
  }, [open, imagePrompt, slotCopy, copyOverlay, exportWidthPx, baseImageUrl]);

  const saveExtras = useMemo(
    (): EcomCopyLayoutStudioSaveExtras => ({
      slotCopy: primarySlotCopyFromOverlay(overlay),
      copyOverlay: overlay,
      burnCopyInImage: false,
    }),
    [overlay],
  );

  const markPreviewStale = () => {
    if (previewUrl) setPreviewStale(true);
  };

  const handleOverlayChange = (next: EcomCopyOverlay) => {
    markPreviewStale();
    setOverlay(next);
  };

  const measureOverlayFromCanvas = async (): Promise<EcomCopyOverlay> => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    return canvasRef.current?.overlayWithMeasuredLayout() ?? overlay;
  };

  const handleGeneratePreview = async () => {
    if (!onPreview || !baseImageUrl) return;
    setLocalPreviewBusy(true);
    try {
      if (workbenchView === "preview") setWorkbenchView("edit");
      const measured = await measureOverlayFromCanvas();
      const extras: EcomCopyLayoutStudioSaveExtras = {
        ...saveExtras,
        copyOverlay: measured,
      };
      const result = await onPreview(promptDraft.trim(), extras);
      if (result?.previewUrl) {
        setPreviewUrl(result.previewUrl);
        setOverlay(measured);
        setPreviewStale(false);
        setWorkbenchView("preview");
      }
    } finally {
      setLocalPreviewBusy(false);
    }
  };

  const handleConfirmCompose = async () => {
    if (!previewUrl) return;
    const handler = onConfirmCompose ?? onCompose;
    if (!handler) return;
    const measured = await measureOverlayFromCanvas();
    const extras: EcomCopyLayoutStudioSaveExtras = {
      ...saveExtras,
      copyOverlay: measured,
    };
    if (onConfirmCompose) {
      await onConfirmCompose(promptDraft.trim(), extras, { previewUrl });
    } else {
      await onCompose!(promptDraft.trim(), extras);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed inset-0 left-0 top-0 z-[300] flex h-[100dvh] max-h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 bg-white p-0 sm:rounded-none">
        <DialogHeader className="relative shrink-0 border-b border-[#e8e8ed] px-5 py-3.5 pr-14">
          <div className="min-w-0 max-w-[min(100%,280px)] sm:max-w-[36%]">
            <DialogTitle className="text-base font-semibold leading-snug text-[#1d1d1f]">
              {title}
            </DialogTitle>
            <p className="mt-0.5 text-xs text-[#86868b]">程序排版 · 导出 {overlay.exportWidthPx}px</p>
          </div>
          {twoStepCompose ? (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 justify-center px-14">
              <div className="pointer-events-auto">
                <WorkbenchToggle
                  view={workbenchView}
                  onChange={setWorkbenchView}
                  previewReady={Boolean(previewUrl)}
                />
              </div>
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <div className="relative flex min-h-[min(52vh,520px)] min-w-0 flex-1 flex-col bg-[#f5f5f7] lg:min-h-0">
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 py-5 sm:px-8 sm:py-6">
              <EcomCopyOverlayCanvas
                ref={canvasRef}
                baseImageUrl={baseImageUrl}
                aspectClassName={aspectClassName}
                overlay={overlay}
                onChange={handleOverlayChange}
                selectedLayerId={selectedLayerId}
                onSelectLayer={setSelectedLayerId}
                emptyHint="请先出无字底图，再在此拖拽排版"
                fillWorkbench
                maxPreviewWidthPx={1200}
                frameClassName="shadow-2xl ring-1 ring-black/10"
                composedPreviewUrl={
                  workbenchView === "preview" && previewUrl ? previewUrl : null
                }
              />
            </div>
            <p className="shrink-0 pb-3 text-center text-[11px] text-[#86868b]">
              {workbenchView === "edit"
                ? "点选文案块 · 拖拽移动 · 拖角调整宽度"
                : previewStale
                  ? "排版已变更，请重新生成预览"
                  : "合成预览（与保存成图一致）"}
            </p>
          </div>

          <aside className="ecom-scrollbar-thin flex w-full shrink-0 flex-col border-t border-[#e8e8ed] bg-[#fafafa] lg:w-[min(400px,38vw)] lg:border-l lg:border-t-0">
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <InspectorSection title="文案" description="选中块后在画布上拖拽定位">
                <EcomCopyOverlayLayersEditor
                  overlay={overlay}
                  onChange={handleOverlayChange}
                  selectedLayerId={selectedLayerId}
                  onSelectLayerId={setSelectedLayerId}
                  disabled={busy}
                  layout="studio"
                  aiCopyRestore={aiCopy || undefined}
                  onRestoreAiCopy={
                    aiCopy && selectedLayerId
                      ? () => {
                          markPreviewStale();
                          setOverlay((prev) =>
                            patchOverlayLayerText(prev, selectedLayerId, aiCopy),
                          );
                        }
                      : undefined
                  }
                />
              </InspectorSection>

              <InspectorSection title="样式">
                <EcomCopyOverlayLayerControls
                  overlay={overlay}
                  selectedLayer={selectedLayer}
                  onChange={handleOverlayChange}
                  variant="studio"
                />
              </InspectorSection>

              {rightColumnExtras ? (
                <InspectorSection title="更多">{rightColumnExtras}</InspectorSection>
              ) : null}

              <InspectorSection
                title="无字底图提示词"
                description="仅重出摄影底图时使用，改字不触发重新生图"
              >
                <textarea
                  className={promptTextareaClass}
                  value={promptDraft}
                  onChange={(e) => {
                    markPreviewStale();
                    setPromptDraft(e.target.value);
                  }}
                  placeholder="中文生图描述…"
                />
              </InspectorSection>
            </div>
          </aside>
        </div>

        <DialogFooter className="shrink-0 flex-col gap-3 border-t border-[#e8e8ed] bg-white px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[#86868b] sm:max-w-[40%]">{hint}</p>
          <div className="flex flex-wrap justify-end gap-2">
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
            {twoStepCompose ? (
              <>
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={busy || !promptDraft.trim()}
                  onClick={() => void onSave(promptDraft.trim(), saveExtras)}
                >
                  {saving ? "保存中…" : "仅保存草稿"}
                </EcomButtonSecondary>
                <EcomButtonSecondary
                  type="button"
                  size="sm"
                  disabled={busy || !baseImageUrl || !overlayHasAnyCopy(overlay)}
                  onClick={() => void handleGeneratePreview()}
                >
                  {previewBusy ? "生成中…" : "生成预览"}
                </EcomButtonSecondary>
                <EcomButtonPrimary
                  type="button"
                  size="sm"
                  disabled={
                    busy ||
                    !previewUrl ||
                    previewStale ||
                    !(onConfirmCompose ?? onCompose)
                  }
                  onClick={() => void handleConfirmCompose()}
                >
                  {composing ? "保存中…" : "保存并关闭"}
                </EcomButtonPrimary>
              </>
            ) : (
              <>
                {onCompose ? (
                  <EcomButtonPrimary
                    type="button"
                    size="sm"
                    disabled={busy || !baseImageUrl || !overlayHasAnyCopy(overlay)}
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
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
