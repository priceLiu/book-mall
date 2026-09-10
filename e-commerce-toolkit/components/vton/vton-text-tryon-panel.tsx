"use client";

import { Cpu, Loader2, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { VtonResultImageHoverActions } from "@/components/vton/vton-result-image-hover-actions";
import {
  VTON_RESULT_LABEL_CLASS,
  VTON_RESULTS_GRID_CLASS,
  VtonTryonGeneratingSlot,
  VtonTryonResultAspectFrame,
  vtonTryonResultShellClass,
} from "@/components/vton/vton-results-grid";
import {
  coerceVtonModelImageSize,
  type VtonModelImageSize,
} from "@/lib/vton-image-quality";
import { downloadRemoteImageUrl } from "@/lib/ecom-download-url";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { openVtonFittingRoomInNewTab } from "@/lib/vton-fitting-room-link";
import { useSaveToCatalog } from "@/lib/use-save-to-catalog";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { formatStoryboardImageModelTypeLabel } from "@/lib/storyboard-image-model-type";
import {
  normalizeVtonTextTryonPrompt,
  VTON_TEXT_TRYON_DEFAULT_PROMPT,
} from "@/lib/vton-text-tryon-default-prompt";
import { buildVtonTextTryonMentionRefs } from "@/lib/vton-text-tryon-mention-refs";
import type { VtonTextTryonRef, VtonTextTryonResult } from "@/lib/vton-types";

function VtonTextTryonResultCell({
  result,
  label,
  modelImageSize,
  tileDisabled,
  previewItems,
  onPreview,
  onDownload,
  onSaveResultToAssets,
  onGenerate,
}: {
  result: VtonTextTryonResult;
  label: string;
  modelImageSize: VtonModelImageSize;
  tileDisabled: boolean;
  previewItems: Array<{ src: string; title: string; thumbSrc: string }>;
  onPreview: (src: string, title: string, items: typeof previewItems) => void;
  onDownload: (url: string, title: string) => void | Promise<void>;
  onSaveResultToAssets?: (ossUrl: string, title: string) => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
}) {
  const saveToCatalog = useSaveToCatalog();
  const displayUrl = result.ossUrl.trim();
  const saveTitle = `文生试衣 ${new Date(result.createdAt).toLocaleString()}`;

  return (
    <div className="flex min-w-0 flex-col">
      <div className={vtonTryonResultShellClass()}>
        <VtonTryonResultAspectFrame modelImageSize={modelImageSize} className="group/image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={label}
            className="h-full w-full object-contain object-center"
            draggable={false}
            referrerPolicy="no-referrer"
          />
          <VtonResultImageHoverActions
            disabled={tileDisabled}
            onPreview={() => onPreview(displayUrl, label, previewItems)}
            onDownload={() => void onDownload(displayUrl, label)}
            onSaveToAssets={
              onSaveResultToAssets
                ? () => void onSaveResultToAssets(displayUrl, saveTitle)
                : undefined
            }
            onSaveToCatalog={() =>
              saveToCatalog({
                url: displayUrl,
                prompt: result.prompt,
                sourceModule: "ecom-vton-text",
                sourceAssetId: result.id,
              })
            }
            onOpenFittingRoom={openVtonFittingRoomInNewTab}
            onRegenerate={!tileDisabled ? () => void onGenerate() : undefined}
          />
        </VtonTryonResultAspectFrame>
      </div>
      <p className={VTON_RESULT_LABEL_CLASS} title={result.modelKey}>
        {result.modelKey}
      </p>
    </div>
  );
}

type Props = {
  refs: VtonTextTryonRef[];
  prompt: string;
  results: VtonTextTryonResult[];
  modelKey: string;
  models: StoryboardGatewayModel[];
  modelsLoading?: boolean;
  busy?: boolean;
  generating?: boolean;
  onPromptChange: (prompt: string) => void;
  onPromptBlur?: () => void;
  onModelChange: (modelKey: string) => void;
  onUpload: (file: File) => Promise<void>;
  onRemoveRef: (refId: string) => Promise<void>;
  onAttachAssets?: (assets: Array<{ id: string; ossUrl: string; title: string }>) => Promise<void>;
  onAttachFromModelLibrary?: (ossUrl: string, label?: string) => Promise<void>;
  onGenerate: () => Promise<void>;
  onClearEditor: () => Promise<void>;
  onSaveResultToAssets?: (ossUrl: string, title: string) => Promise<void>;
  /** 与需穿衣试衣结果同比例（模特底图 modelImageSize） */
  modelImageSize?: VtonModelImageSize;
  /** 参考图上传进度 0–100；null 为不确定进度 */
  uploadProgress?: number | null;
  uploadProgressLabel?: string;
  uploading?: boolean;
};

export function VtonTextTryonPanel({
  refs,
  prompt,
  results,
  modelKey,
  models,
  modelsLoading,
  busy,
  generating,
  onPromptChange,
  onPromptBlur,
  onModelChange,
  onUpload,
  onRemoveRef,
  onAttachAssets,
  onAttachFromModelLibrary,
  onGenerate,
  onClearEditor,
  onSaveResultToAssets,
  modelImageSize: modelImageSizeProp,
  uploadProgress = null,
  uploadProgressLabel,
  uploading = false,
}: Props) {
  const modelImageSize = coerceVtonModelImageSize(modelImageSizeProp);
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [draftModelKey, setDraftModelKey] = useState(modelKey);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);

  useEffect(() => {
    if (!modelPickerOpen) setDraftModelKey(modelKey);
  }, [modelKey, modelPickerOpen]);
  const previewItems = useMemo(() => {
    const seen = new Set<string>();
    const items: Array<{ src: string; title: string; thumbSrc: string }> = [];
    results.forEach((result, index) => {
      const src = result.ossUrl.trim();
      if (!src || seen.has(src)) return;
      seen.add(src);
      items.push({
        src,
        title: `文生试衣 ${results.length - index}`,
        thumbSrc: src,
      });
    });
    return items;
  }, [results]);

  const { preview, galleryItems, openPreview, closePreview } = useEcomImagePreview(previewItems);

  const mentionRefs = useMemo(() => buildVtonTextTryonMentionRefs(refs), [refs]);
  const mentionRefsKey = useMemo(
    () => refs.map((r) => `${r.id}:${r.ossUrl}`).join("|"),
    [refs],
  );
  const uploadDisabled = Boolean(busy) || Boolean(generating);

  const modelDisplay =
    models.find((m) => m.modelKey === modelKey)?.displayName ?? modelKey;
  const modelTypeLabel = formatStoryboardImageModelTypeLabel(modelKey, "IMAGE");

  const canGenerate =
    refs.length > 0 && prompt.trim().length > 0 && !busy && !generating;

  const tileDisabled = Boolean(busy) || Boolean(generating);
  const showResultsGrid = results.length > 0 || generating;

  async function handleDownload(url: string, title: string) {
    const safe = title.replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 40) || "text-tryon";
    await downloadRemoteImageUrl(url, `${safe}.jpg`);
  }

  async function handleFiles(files: File[]) {
    if (!files.length || uploadDisabled) return;
    for (const file of files) {
      await onUpload(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-white">
        <section className="border-b border-[#e8e8ed] px-4 py-4 sm:px-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
              试衣参考图
            </span>
            <span className="text-[10px] text-[#86868b]">
              {refs.length} 张 · {IMAGE_UPLOAD_DROP_HINT}
            </span>
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-[#6e6e73]">
            上传参考图并在 Prompt 中 @ 引用。默认模板约定：先传服装 → @图片1，再传眼镜 → @图片2（模特头像可从模特库追加）。
          </p>
          <EcomRefUploadCard
            title="试衣参考"
            items={refs
              .filter((r) => r.ossUrl?.trim())
              .map((r) => ({ id: r.id, ossUrl: r.ossUrl.trim(), label: r.label ?? "" }))}
            emptyHint={`拖放 / 粘贴 / 模特库 / 我的资产，上传参考图（数量不限）。${IMAGE_UPLOAD_DROP_HINT}`}
            removeLabel="删除"
            accept="image/*"
            busy={uploadDisabled}
            uploadProgress={uploadProgress}
            uploadProgressLabel={uploadProgressLabel}
            showUploadProgress={uploading}
            inputRef={inputRef}
            onPreviewItem={(item) => openPreview(item.ossUrl, item.label)}
            onUploadFiles={(files) => void handleFiles(files)}
            onOpenFilePicker={() => inputRef.current?.click()}
            onOpenAssetPicker={onAttachAssets ? () => setAssetPickerOpen(true) : undefined}
            headerActions={
              onAttachFromModelLibrary ? (
                <EcomButtonSecondary
                  size="sm"
                  type="button"
                  disabled={uploadDisabled}
                  className="h-7 px-2 text-[10px]"
                  onClick={() => setModelLibraryOpen(true)}
                >
                  <UserRound className="h-3 w-3 shrink-0" />
                  模特库
                </EcomButtonSecondary>
              ) : undefined
            }
            onRemove={(id) => void onRemoveRef(id)}
          />
        </section>

        <section className="border-b border-[#e8e8ed] px-4 py-4 sm:px-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            参考图 + Prompt
          </p>
          <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
            用 @ 引用上方参考图，描述模特姿态、场景与服装细节；删除 Prompt 中的 @ 引用后，下方参考资产条会同步移除（上方试衣参考图不受影响）。
          </p>
          <p className="mb-2 text-[11px] font-semibold text-[#1d1d1f]">Prompt（可 @ 图片）</p>
          <ProductDesignPromptMentionTextarea
            key={mentionRefsKey}
            value={prompt}
            referenceImages={mentionRefs}
            syncRefBarWithPrompt
            mentionBadgeVariant="thumbnail"
            refBarHint="参考资产 · Prompt 中已 @ 引用的素材"
            disabled={Boolean(busy) || Boolean(generating)}
            onChange={onPromptChange}
            onBlur={onPromptBlur}
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8e8ed] bg-white px-3 py-1.5 text-[11px] text-[#1d1d1f] hover:border-[#d2d2d7] disabled:opacity-50"
              disabled={Boolean(busy) || Boolean(generating) || modelsLoading}
              onClick={() => setModelPickerOpen(true)}
            >
              <Cpu className="h-3.5 w-3.5 shrink-0 text-[#6e6e73]" />
              <span className="max-w-[140px] truncate">{modelDisplay}</span>
              <span className="text-[10px] text-[#86868b]">{modelTypeLabel}</span>
            </button>
            <EcomButtonPrimary
              size="sm"
              type="button"
              disabled={!canGenerate}
              onClick={() => void onGenerate()}
            >
              {generating ? (
                <>
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  生成中…
                </>
              ) : (
                "生成试衣图"
              )}
            </EcomButtonPrimary>
            {!prompt.trim() ? (
              <button
                type="button"
                className="text-[11px] text-[#0071e3] hover:underline disabled:opacity-50"
                disabled={Boolean(busy) || Boolean(generating)}
                onClick={() =>
                  onPromptChange(normalizeVtonTextTryonPrompt(VTON_TEXT_TRYON_DEFAULT_PROMPT))
                }
              >
                填入默认 Prompt
              </button>
            ) : null}
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={Boolean(busy) || Boolean(generating)}
              onClick={() => void onClearEditor()}
            >
              <Trash2 className="mr-1 h-3 w-3" />
              清空编辑区
            </EcomButtonSecondary>
          </div>
        </section>

        <section className="px-4 py-4 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[#1d1d1f]">生成结果</h3>
            {showResultsGrid ? (
              <span className="text-[10px] text-[#86868b]">
                {generating && results.length === 0
                  ? "生成中…"
                  : `${results.length + (generating ? 1 : 0)} 张`}
              </span>
            ) : null}
          </div>
          {!showResultsGrid ? (
            <div className="flex min-h-[28vh] flex-col items-center justify-center rounded-lg border border-dashed border-[#e8e8ed] bg-[#fafafa] px-6 py-10 text-center">
              <p className="max-w-md text-sm text-[#6e6e73]">
                上传参考图、填写 Prompt 并点击「生成试衣图」后，成片将显示在此。生成完成后可继续在上方的编辑区调整素材与 Prompt。
              </p>
            </div>
          ) : (
            <div className={VTON_RESULTS_GRID_CLASS}>
              {generating ? (
                <div className="flex min-w-0 flex-col">
                  <div className={vtonTryonResultShellClass({ running: true })}>
                    <VtonTryonGeneratingSlot modelImageSize={modelImageSize} label="生成中" />
                  </div>
                  <p className={VTON_RESULT_LABEL_CLASS}>生成中…</p>
                </div>
              ) : null}
              {results.map((result, index) => {
                const label = `文生试衣 ${results.length - index}`;
                return (
                  <VtonTextTryonResultCell
                    key={result.id}
                    result={result}
                    label={label}
                    modelImageSize={modelImageSize}
                    tileDisabled={tileDisabled}
                    previewItems={previewItems}
                    onPreview={openPreview}
                    onDownload={handleDownload}
                    onSaveResultToAssets={onSaveResultToAssets}
                    onGenerate={onGenerate}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      <StoryboardModelPickerDialog
        open={modelPickerOpen}
        onOpenChange={setModelPickerOpen}
        mode="image"
        nativeOverlay
        dialogTitle="选择图片编辑模型"
        dialogDescription="文生试衣使用图片编辑 / 多图参考模型（如 GPT Image 2、万相 2.7 Pro、千问 3.0 Pro）。"
        confirmLabel="确认"
        footerHint="确认后将用于本次生成。"
        models={models}
        value={draftModelKey}
        onChange={setDraftModelKey}
        onConfirm={(key) => {
          onModelChange(key);
          setModelPickerOpen(false);
        }}
        modelsLoading={modelsLoading}
        hideTypeFilter
      />

      {onAttachAssets ? (
        <EcomAssetPickerDialog
          open={assetPickerOpen}
          onOpenChange={setAssetPickerOpen}
          maxSelect={999}
          onConfirm={async (assets) => {
            setAssetPickerOpen(false);
            if (assets.length) await onAttachAssets(assets);
          }}
        />
      ) : null}

      {onAttachFromModelLibrary ? (
        <EcomModelLibraryPickerDialog
          open={modelLibraryOpen}
          onOpenChange={setModelLibraryOpen}
          closeOnPick={false}
          onPick={async (entry) => {
            if (uploadDisabled) return;
            await onAttachFromModelLibrary(entry.ossUrl, entry.name);
          }}
        />
      ) : null}

      <EcomImagePreviewHost preview={preview} galleryItems={galleryItems} onClose={closePreview} />
    </>
  );
}
