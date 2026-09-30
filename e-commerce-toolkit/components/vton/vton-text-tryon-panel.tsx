"use client";

import { BookOpen, Cpu, Loader2, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  EcomCatalogPickerDialog,
  type CatalogPickerEntry,
} from "@/components/model-shot/ecom-catalog-picker-dialog";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { ProductDesignPromptMentionTextarea } from "@/components/product-design/product-design-prompt-mention-textarea";
import { EcomGenerateCreditsBeside } from "@/components/billing/ecom-generate-credits-beside";
import { StoryboardModelPickerDialog } from "@/components/storyboard/storyboard-model-picker-dialog";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { VtonPromptPreviewDialog } from "@/components/vton/vton-prompt-preview-dialog";
import { VtonResultImageHoverActions } from "@/components/vton/vton-result-image-hover-actions";
import {
  VTON_RESULT_LABEL_CLASS,
  VTON_RESULTS_GRID_CLASS,
  VtonDynamicAspectFrame,
  VtonTryonGeneratingSlot,
  vtonTryonResultShellClass,
} from "@/components/vton/vton-results-grid";
import { aspectRatioForImageSize } from "@/lib/storyboard-image-size-options";
import type { VtonModelImageSize } from "@/lib/vton-image-quality";
import { downloadMediaUrl } from "@/lib/ecom-media-download";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { openVtonFittingRoomInNewTab } from "@/lib/vton-fitting-room-link";
import { useSaveToCatalog } from "@/lib/use-save-to-catalog";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import { formatStoryboardImageModelTypeLabel } from "@/lib/storyboard-image-model-type";
import {
  normalizeVtonTextTryonPrompt,
  VTON_TEXT_TRYON_DEFAULT_PROMPT,
} from "@/lib/vton-text-tryon-default-prompt";
import { fetchEcomSceneLibraryCatalog } from "@/lib/ecom-scene-library-api";
import { sceneToCatalogPickerEntry } from "@/lib/ecom-scene-library/picker";
import type { EcomSceneLibraryEntry } from "@/lib/ecom-scene-library/types";
import { buildVtonTextTryonMentionRefs } from "@/lib/vton-text-tryon-mention-refs";
import { vtonTextTryonSceneRefs } from "@/lib/vton-text-tryon-scene-ref";
import type { VtonTextTryonRef, VtonTextTryonResult } from "@/lib/vton-types";

function VtonTextTryonResultCell({
  result,
  label,
  fallbackRatio,
  tileDisabled,
  previewItems,
  onPreview,
  onDownload,
  onPreviewPrompt,
  onSaveResultToAssets,
  onGenerate,
}: {
  result: VtonTextTryonResult;
  label: string;
  fallbackRatio: string;
  tileDisabled: boolean;
  previewItems: Array<{ src: string; title: string; thumbSrc: string }>;
  onPreview: (src: string, title: string, items: typeof previewItems) => void;
  onDownload: (url: string, title: string) => void | Promise<void>;
  onPreviewPrompt: (title: string, prompt: string) => void;
  onSaveResultToAssets?: (ossUrl: string, title: string) => void | Promise<void>;
  onGenerate: () => void | Promise<void>;
}) {
  const saveToCatalog = useSaveToCatalog();
  const displayUrl = result.ossUrl.trim();
  const saveTitle = `文生试衣 ${new Date(result.createdAt).toLocaleString()}`;

  return (
    <div className="flex min-w-0 flex-col">
      <div className={vtonTryonResultShellClass()}>
        <VtonDynamicAspectFrame
          width={result.width}
          height={result.height}
          ratio={result.ratio}
          fallbackRatio={fallbackRatio}
          className="group/image"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayUrl}
            alt={label}
            className="h-full w-full cursor-zoom-in object-contain object-center"
            draggable={false}
            referrerPolicy="no-referrer"
            onClick={() => onPreview(displayUrl, label, previewItems)}
          />
          <VtonResultImageHoverActions
            disabled={tileDisabled}
            onPreview={() => onPreview(displayUrl, label, previewItems)}
            onDownload={() => void onDownload(displayUrl, label)}
            onPreviewPrompt={() => onPreviewPrompt(label, result.prompt)}
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
        </VtonDynamicAspectFrame>
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
  onPickSceneLibraryEntry?: (entry: CatalogPickerEntry) => Promise<void>;
  onGenerate: () => Promise<void>;
  onClearEditor: () => Promise<void>;
  onSaveResultToAssets?: (ossUrl: string, title: string) => Promise<void>;
  /** 文生试衣出图像素尺寸（弹层列出模型全部比例） */
  imageSize?: string;
  onImageSizeChange?: (imageSize: string) => void;
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
  onPickSceneLibraryEntry,
  onGenerate,
  onClearEditor,
  onSaveResultToAssets,
  imageSize,
  onImageSizeChange,
  modelImageSize: _modelImageSizeProp,
  uploadProgress = null,
  uploadProgressLabel,
  uploading = false,
}: Props) {
  const selectedRatio = imageSize?.trim()
    ? aspectRatioForImageSize(imageSize)
    : "3:4";
  const inputRef = useRef<HTMLInputElement>(null);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [draftModelKey, setDraftModelKey] = useState(modelKey);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [modelLibraryOpen, setModelLibraryOpen] = useState(false);
  const [sceneCatalogOpen, setSceneCatalogOpen] = useState(false);
  const [sceneCatalog, setSceneCatalog] = useState<EcomSceneLibraryEntry[]>([]);
  const [sceneCatalogLoading, setSceneCatalogLoading] = useState(false);
  const [promptPreview, setPromptPreview] = useState<{
    title: string;
    prompt: string;
  } | null>(null);

  useEffect(() => {
    if (!modelPickerOpen) setDraftModelKey(modelKey);
  }, [modelKey, modelPickerOpen]);

  useEffect(() => {
    if (!sceneCatalogOpen || sceneCatalog.length > 0) return;
    setSceneCatalogLoading(true);
    void fetchEcomSceneLibraryCatalog()
      .then((catalog) => {
        const list = catalog.scenes.length
          ? catalog.scenes
          : [...(catalog.platform ?? []), ...(catalog.user ?? [])];
        setSceneCatalog(list);
      })
      .finally(() => setSceneCatalogLoading(false));
  }, [sceneCatalogOpen, sceneCatalog.length]);

  const scenePickerEntries = useMemo(
    (): CatalogPickerEntry[] => sceneCatalog.map(sceneToCatalogPickerEntry),
    [sceneCatalog],
  );

  const sceneTextRefs = useMemo(() => vtonTextTryonSceneRefs(refs), [refs]);
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
    () =>
      refs
        .map((r) => `${r.id}:${r.kind ?? ""}:${r.ossUrl ?? ""}:${r.scenePrompt ?? ""}`)
        .join("|"),
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

  function handleDownload(url: string, title: string) {
    const safe = title.replace(/[^\w\u4e00-\u9fff-]+/g, "_").slice(0, 40) || "text-tryon";
    void downloadMediaUrl(url, `${safe}.jpg`);
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
            上传参考图并在 Prompt 中 @ 引用；场景库可追加 @场景N（文字场景）或场景参考图。默认：服装 → @图片1，眼镜 → @图片2，模特可从模特库追加。
          </p>
          <EcomRefUploadCard
            title="试衣参考"
            items={refs
              .filter((r) => r.ossUrl?.trim())
              .map((r) => ({
                id: r.id,
                ossUrl: r.ossUrl!.trim(),
                label: r.label ?? "",
              }))}
            emptyHint={`拖放 / 粘贴 / 模特库 / 场景库 / 我的资产。${IMAGE_UPLOAD_DROP_HINT}`}
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
              onAttachFromModelLibrary || onPickSceneLibraryEntry ? (
                <div className="flex flex-wrap items-center justify-end gap-1">
                  {onAttachFromModelLibrary ? (
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
                  ) : null}
                  {onPickSceneLibraryEntry ? (
                    <EcomButtonSecondary
                      size="sm"
                      type="button"
                      disabled={uploadDisabled}
                      className="h-7 px-2 text-[10px]"
                      onClick={() => setSceneCatalogOpen(true)}
                    >
                      <BookOpen className="h-3 w-3 shrink-0" />
                      场景库
                    </EcomButtonSecondary>
                  ) : null}
                </div>
              ) : undefined
            }
            onRemove={(id) => void onRemoveRef(id)}
          />
          {sceneTextRefs.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {sceneTextRefs.map((r, i) => (
                <li
                  key={r.id}
                  className="flex items-start gap-2 rounded-lg border border-[#e8e8ed] bg-[#fafafa] px-2.5 py-2 text-[10px] text-[#424245]"
                >
                  <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#0071e3]" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[#1d1d1f]">
                      @场景{i + 1} · {r.label ?? "场景库"}
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-[#6e6e73]">{r.scenePrompt}</p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 text-[#0071e3] hover:underline disabled:opacity-50"
                    disabled={uploadDisabled}
                    onClick={() => void onRemoveRef(r.id)}
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section className="border-b border-[#e8e8ed] px-4 py-4 sm:px-5">
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[#6e6e73]">
            参考图 + Prompt
          </p>
          <p className="mb-4 text-[11px] leading-relaxed text-[#6e6e73]">
            用 @图片N 引用参考图、@场景N 引用场景库文案；删除 Prompt 中的 @ 后，下方参考资产条会同步移除（上方缩略图区仅展示图片参考）。
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
            <EcomGenerateCreditsBeside modelKey={modelKey} imageCount={1} />
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
                    <VtonTryonGeneratingSlot
                      ratio={selectedRatio}
                      label="生成中"
                    />
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
                    fallbackRatio={selectedRatio}
                    tileDisabled={tileDisabled}
                    previewItems={previewItems}
                    onPreview={openPreview}
                    onDownload={handleDownload}
                    onPreviewPrompt={(title, p) =>
                      setPromptPreview({ title: `${title} · 提示词`, prompt: p })
                    }
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
        showAllImageSizes
        imageSize={imageSize}
        onImageSizeChange={onImageSizeChange}
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

      {onPickSceneLibraryEntry ? (
        <EcomCatalogPickerDialog
          open={sceneCatalogOpen}
          title={sceneCatalogLoading ? "加载场景库…" : "选择场景"}
          entries={scenePickerEntries}
          onOpenChange={setSceneCatalogOpen}
          onPick={(entry) => onPickSceneLibraryEntry(entry)}
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

      <VtonPromptPreviewDialog
        open={Boolean(promptPreview)}
        title={promptPreview?.title ?? "提示词预览"}
        prompt={promptPreview?.prompt ?? ""}
        onClose={() => setPromptPreview(null)}
      />

      <EcomImagePreviewHost preview={preview} galleryItems={galleryItems} onClose={closePreview} />
    </>
  );
}
