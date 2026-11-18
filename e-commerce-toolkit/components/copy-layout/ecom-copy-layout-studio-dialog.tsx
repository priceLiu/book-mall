"use client";

import {
  EcomCopyOverlayCanvas,
  EcomCopyOverlayLayerControls,
  EcomCopyOverlayLayersEditor,
  FullscreenImageEditorShell,
  overlayHasAnyCopy,
  primarySlotCopyFromOverlay,
  patchOverlayLayerText,
  resolveOverlayForEditor,
  type EcomCopyOverlay,
  type EcomCopyOverlayCanvasHandle,
} from "@private/ecom-copy-overlay";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import { cn } from "@/lib/utils";

/** 与右栏 360px 底栏两列按钮同宽同高：(360 - 24 - 8) / 2 */
const editorActionSize = "h-8 w-[164px]";
const editorGhostBtn =
  `inline-flex ${editorActionSize} items-center justify-center rounded-lg border border-white/10 bg-[#2A2A2A] px-3 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40`;
const editorPrimaryBtn =
  `inline-flex ${editorActionSize} items-center justify-center rounded-lg border border-white/15 bg-white/10 px-3 text-[13px] font-medium text-white hover:bg-white/15 disabled:opacity-40`;
const editorWideBtn =
  "inline-flex h-8 w-full items-center justify-center whitespace-nowrap rounded-lg border border-white/10 bg-[#2A2A2A] px-3 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40";

function EditorBrandMark() {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#0071e3] text-sm font-bold text-white"
      aria-hidden
    >
      商
    </span>
  );
}

export type EcomCopyLayoutReferenceImage = {
  url: string;
  label?: string;
};

export type EcomCopyLayoutStudioSaveExtras = {
  slotCopy?: string;
  copyOverlay?: EcomCopyOverlay;
  burnCopyInImage?: boolean;
  layoutComposedPreviewUrl?: string | null;
};

export type EcomCopyLayoutStudioPreviewResult = {
  previewUrl: string;
};

type WorkbenchView = "edit" | "preview";

type LayoutStudioTask = "idle" | "preview" | "draft" | "apply";

const LAYOUT_TASK_LABEL: Record<Exclude<LayoutStudioTask, "idle">, string> = {
  preview: "正在生成预览…",
  draft: "正在保存草稿…",
  apply: "正在合成并保存…",
};

type EditorBaseline = {
  prompt: string;
  overlayJson: string;
  previewUrl: string | null;
};

function editorBaselineSnapshot(input: {
  prompt: string;
  overlay: EcomCopyOverlay;
  previewUrl: string | null;
}): EditorBaseline {
  return {
    prompt: input.prompt.trim(),
    overlayJson: JSON.stringify(input.overlay),
    previewUrl: input.previewUrl,
  };
}

function editorBaselineDirty(current: EditorBaseline, baseline: EditorBaseline): boolean {
  return (
    current.prompt !== baseline.prompt ||
    current.overlayJson !== baseline.overlayJson ||
    current.previewUrl !== baseline.previewUrl
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  baseImageUrl: string | null;
  imagePrompt: string;
  slotCopy?: string;
  slotCopyAi?: string;
  copyOverlay?: EcomCopyOverlay | null;
  /** 上次保存草稿时附带的合成预览，重进后可继续「保存使用」 */
  layoutComposedPreviewUrl?: string | null;
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
  /** 用当前提示词重出中间这张底图；不关闭编辑器 */
  onRegenerateImage?: (prompt: string) => void | Promise<void>;
  rewriteButtonLabel?: string;
  /** 打开时冻结的原提示词；缺省用 imagePrompt */
  sourcePrompt?: string;
  referenceImages?: EcomCopyLayoutReferenceImage[];
  leftColumnExtras?: ReactNode;
  rightColumnExtras?: ReactNode;
  /** 画布全屏层传 z-[2000] */
  zClassName?: string;
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
    <section className={cn("space-y-2", className)}>
      <h3 className="text-sm font-medium text-white">{title}</h3>
      {description ? (
        <p className="text-[11px] leading-relaxed text-white/45">{description}</p>
      ) : null}
      <div>{children}</div>
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
    <div className="inline-flex rounded-full border border-white/15 bg-black/40 p-0.5">
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
                ? "bg-white/15 text-white"
                : "text-white/50 hover:text-white/80",
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
  layoutComposedPreviewUrl = null,
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
  onRegenerateImage,
  rewriteButtonLabel = "AI 重写本条（文案+提示词）",
  sourcePrompt,
  referenceImages = [],
  leftColumnExtras,
  rightColumnExtras,
  zClassName,
}: Props) {
  const { unsavedLayoutClose, alert } = useDialogs();
  const [promptDraft, setPromptDraft] = useState(imagePrompt);
  const [sourcePromptText, setSourcePromptText] = useState(sourcePrompt ?? imagePrompt);
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
  const [layoutTask, setLayoutTask] = useState<LayoutStudioTask>("idle");
  const layoutTaskLockRef = useRef(false);
  const [regenBusy, setRegenBusy] = useState(false);
  const [workbenchView, setWorkbenchView] = useState<WorkbenchView>("edit");
  const canvasRef = useRef<EcomCopyOverlayCanvasHandle>(null);
  const savedBaselineRef = useRef<EditorBaseline | null>(null);

  const aiCopy = slotCopyAi.trim();
  const selectedLayer = overlay.layers.find((l) => l.id === selectedLayerId) ?? overlay.layers[0];
  const twoStepCompose = Boolean(onPreview);
  const layoutTaskBusy = layoutTask !== "idle";
  const busy =
    layoutTaskBusy || saving || composing || previewing || regenBusy;

  const wasOpenRef = useRef(false);
  const incomingPromptRef = useRef(imagePrompt);
  const baseUrlRef = useRef(baseImageUrl);
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = resolveOverlayForEditor({
        overlay: copyOverlay,
        text: slotCopy,
        exportWidthPx,
        baseImageUrl: baseImageUrl ?? undefined,
      });
      setPromptDraft(imagePrompt);
      setSourcePromptText((sourcePrompt ?? imagePrompt).trim());
      incomingPromptRef.current = imagePrompt;
      baseUrlRef.current = baseImageUrl;
      setOverlay(next);
      setSelectedLayerId(next.layers[0]?.id ?? "main");
      const restoredPreview = layoutComposedPreviewUrl?.trim() || null;
      setPreviewUrl(restoredPreview);
      setPreviewStale(false);
      setWorkbenchView(restoredPreview ? "preview" : "edit");
      setLayoutTask("idle");
      layoutTaskLockRef.current = false;
      savedBaselineRef.current = editorBaselineSnapshot({
        prompt: imagePrompt,
        overlay: next,
        previewUrl: restoredPreview,
      });
    } else if (open && incomingPromptRef.current !== imagePrompt) {
      incomingPromptRef.current = imagePrompt;
      setPromptDraft(imagePrompt);
    } else if (open && baseUrlRef.current !== baseImageUrl) {
      baseUrlRef.current = baseImageUrl;
      setPreviewUrl(null);
      setPreviewStale(false);
      setWorkbenchView("edit");
    }
    wasOpenRef.current = open;
  }, [
    open,
    imagePrompt,
    sourcePrompt,
    slotCopy,
    copyOverlay,
    layoutComposedPreviewUrl,
    exportWidthPx,
    baseImageUrl,
  ]);

  const saveExtras = useMemo(
    (): EcomCopyLayoutStudioSaveExtras => ({
      slotCopy: primarySlotCopyFromOverlay(overlay),
      copyOverlay: overlay,
      burnCopyInImage: false,
      layoutComposedPreviewUrl: previewUrl,
    }),
    [overlay, previewUrl],
  );

  const markSavedBaseline = useCallback(() => {
    savedBaselineRef.current = editorBaselineSnapshot({
      prompt: promptDraft,
      overlay,
      previewUrl,
    });
  }, [overlay, previewUrl, promptDraft]);

  const hasUnsavedEdits = useCallback(() => {
    const baseline = savedBaselineRef.current;
    if (!baseline) return false;
    const current = editorBaselineSnapshot({ prompt: promptDraft, overlay, previewUrl });
    return editorBaselineDirty(current, baseline);
  }, [overlay, previewUrl, promptDraft]);

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

  const runLayoutTask = useCallback(
    async (phase: Exclude<LayoutStudioTask, "idle">, work: () => Promise<void>) => {
      if (layoutTaskLockRef.current) return;
      layoutTaskLockRef.current = true;
      setLayoutTask(phase);
      try {
        await work();
      } catch (e) {
        const title =
          phase === "preview" ? "预览失败" : phase === "draft" ? "保存草稿失败" : "保存使用失败";
        await alert({
          title,
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        });
        throw e;
      } finally {
        layoutTaskLockRef.current = false;
        setLayoutTask("idle");
      }
    },
    [alert],
  );

  const handleGeneratePreview = useCallback(async () => {
    if (!onPreview || !baseImageUrl) return;
    await runLayoutTask("preview", async () => {
      if (workbenchView === "preview") setWorkbenchView("edit");
      const measured = await measureOverlayFromCanvas();
      const extras: EcomCopyLayoutStudioSaveExtras = {
        ...saveExtras,
        copyOverlay: measured,
      };
      const result = await onPreview(promptDraft.trim(), extras);
      if (!result?.previewUrl?.trim()) {
        throw new Error("未获取到预览图，请稍后重试");
      }
      setPreviewUrl(result.previewUrl);
      setOverlay(measured);
      setPreviewStale(false);
      setWorkbenchView("preview");
    });
  }, [
    baseImageUrl,
    onPreview,
    promptDraft,
    runLayoutTask,
    saveExtras,
    workbenchView,
  ]);

  const handleRegenerateImage = async () => {
    if (!onRegenerateImage) return;
    const prompt = promptDraft.trim();
    if (!prompt) return;
    setRegenBusy(true);
    try {
      await onRegenerateImage(prompt);
    } finally {
      setRegenBusy(false);
    }
  };

  const handleConfirmCompose = useCallback(async () => {
    if (!previewUrl) return;
    const handler = onConfirmCompose ?? onCompose;
    if (!handler) return;
    return runLayoutTask("apply", async () => {
      if (previewStale) {
        throw new Error("排版已变更，请先重新生成预览");
      }
      const measured = await measureOverlayFromCanvas();
      const extras: EcomCopyLayoutStudioSaveExtras = {
        ...saveExtras,
        copyOverlay: measured,
        layoutComposedPreviewUrl: previewUrl,
      };
      if (onConfirmCompose) {
        await onConfirmCompose(promptDraft.trim(), extras, { previewUrl });
      } else {
        await onCompose!(promptDraft.trim(), extras);
      }
      markSavedBaseline();
    });
  }, [
    markSavedBaseline,
    onCompose,
    onConfirmCompose,
    previewStale,
    previewUrl,
    promptDraft,
    runLayoutTask,
    saveExtras,
  ]);

  const canApplySavedPreview = Boolean(
    previewUrl && !previewStale && (onConfirmCompose ?? onCompose),
  );

  const saveDraft = useCallback(async () => {
    if (!promptDraft.trim()) return;
    await runLayoutTask("draft", async () => {
      const measured = await measureOverlayFromCanvas();
      const extras: EcomCopyLayoutStudioSaveExtras = {
        ...saveExtras,
        copyOverlay: measured,
        layoutComposedPreviewUrl: previewUrl,
      };
      await onSave(promptDraft.trim(), extras);
      setOverlay(measured);
      markSavedBaseline();
    });
  }, [markSavedBaseline, onSave, previewUrl, promptDraft, runLayoutTask, saveExtras]);

  const requestClose = useCallback(async () => {
    if (layoutTaskBusy) return;
    if (!hasUnsavedEdits()) {
      onOpenChange(false);
      return;
    }
    const choice = await unsavedLayoutClose({
      applyDisabled: !canApplySavedPreview,
      message: !canApplySavedPreview
        ? "当前有未保存的排版。可先存草稿；要「保存使用」需先生成预览且与当前排版一致。"
        : undefined,
    });
    if (choice === "stay") return;
    if (choice === "draft") {
      try {
        await saveDraft();
        onOpenChange(false);
      } catch {
        /* 进度条与 alert 已提示，保持编辑窗 */
      }
      return;
    }
    if (choice === "apply") {
      try {
        await handleConfirmCompose();
        onOpenChange(false);
      } catch {
        /* 保持编辑窗 */
      }
    }
  }, [
    canApplySavedPreview,
    handleConfirmCompose,
    hasUnsavedEdits,
    layoutTaskBusy,
    onOpenChange,
    saveDraft,
    unsavedLayoutClose,
  ]);

  const visibleRefs = referenceImages.filter((item) => item.url.trim());

  return (
    <FullscreenImageEditorShell
      open={open}
      zClassName={zClassName ?? "z-[280]"}
      title={title}
      onClose={() => void requestClose()}
      headerLeading={<EditorBrandMark />}
      headerCenter={
        twoStepCompose ? (
          <WorkbenchToggle
            view={workbenchView}
            onChange={setWorkbenchView}
            previewReady={Boolean(previewUrl)}
          />
        ) : null
      }
      left={
        <>
          <InspectorSection title="原来的提示词" description="生成本张图时使用，此处只读">
            <p className="whitespace-pre-wrap rounded-md border border-white/10 bg-black/30 px-3 py-2 text-sm leading-relaxed text-white/85">
              {sourcePromptText || "暂无原提示词"}
            </p>
          </InspectorSection>
          <InspectorSection title="引用的图片" description="出图时带入的参考图">
            {visibleRefs.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {visibleRefs.map((item) => (
                  <figure key={item.url} className="min-w-0">
                    <img
                      src={item.url}
                      alt={item.label || ""}
                      className="aspect-square w-full rounded-lg object-cover ring-1 ring-white/10"
                    />
                    {item.label ? (
                      <figcaption className="mt-1 truncate text-[10px] text-white/45">
                        {item.label}
                      </figcaption>
                    ) : null}
                  </figure>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-white/35">暂无引用图</p>
            )}
          </InspectorSection>
          {leftColumnExtras}
        </>
      }
      leftFooter={
        onRewrite ? (
          <button
            type="button"
            className={editorWideBtn}
            disabled={busy || rewriteBusy}
            onClick={onRewrite}
          >
            {rewriteBusy ? "AI 生成中…" : rewriteButtonLabel}
          </button>
        ) : null
      }
      center={
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-4">
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
              frameClassName="shadow-2xl ring-1 ring-white/15"
              composedPreviewUrl={
                workbenchView === "preview" && previewUrl ? previewUrl : null
              }
            />
          </div>
          {onRegenerateImage ? (
            <div className="flex shrink-0 items-center justify-center border-t border-white/10 bg-[#141414] p-3">
              <button
                type="button"
                className={editorPrimaryBtn}
                disabled={busy || !promptDraft.trim()}
                onClick={() => void handleRegenerateImage()}
              >
                {regenBusy ? "生成中…" : "重新生图"}
              </button>
            </div>
          ) : null}
          {layoutTask !== "idle" ? (
            <EcomMediaGeneratingBusy
              label={LAYOUT_TASK_LABEL[layoutTask]}
              progress={null}
              background="overlay"
              className="z-30"
            />
          ) : null}
        </div>
      }
      right={
        <>
          <InspectorSection title="文案" description="选中块后在中间画布上拖拽定位">
            <EcomCopyOverlayLayersEditor
              variant="dark"
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
        </>
      }
      rightFooter={
        <div className="mx-auto grid w-[336px] grid-cols-2 gap-2">
          <button
            type="button"
            className={editorGhostBtn}
            disabled={busy}
            onClick={() => void requestClose()}
          >
            取消
          </button>
          {twoStepCompose ? (
            <>
              <button
                type="button"
                className={editorGhostBtn}
                disabled={busy || !promptDraft.trim()}
                onClick={() => void saveDraft()}
              >
                {layoutTask === "draft" ? "保存中…" : "保存草稿"}
              </button>
              <button
                type="button"
                className={editorGhostBtn}
                disabled={busy || !baseImageUrl || !overlayHasAnyCopy(overlay)}
                onClick={() => void handleGeneratePreview()}
              >
                {layoutTask === "preview" ? "生成中…" : "生成预览"}
              </button>
              <button
                type="button"
                className={editorPrimaryBtn}
                disabled={
                  busy ||
                  !previewUrl ||
                  previewStale ||
                  !(onConfirmCompose ?? onCompose)
                }
                onClick={() => void handleConfirmCompose()}
              >
                {layoutTask === "apply" ? "保存中…" : "保存使用"}
              </button>
            </>
          ) : (
            <>
              {onCompose ? (
                <button
                  type="button"
                  className={editorPrimaryBtn}
                  disabled={busy || !baseImageUrl || !overlayHasAnyCopy(overlay)}
                  onClick={() => void onCompose(promptDraft.trim(), saveExtras)}
                >
                  {composing ? "合成中…" : "合成并保存新版"}
                </button>
              ) : null}
              <button
                type="button"
                className={editorPrimaryBtn}
                disabled={busy || !promptDraft.trim()}
                onClick={() => void onSave(promptDraft.trim(), saveExtras)}
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </>
          )}
        </div>
      }
    />
  );
}
