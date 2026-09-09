"use client";

import { Loader2, Sparkles, UserRound } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { EcomAssetPickerDialog } from "@/components/media/ecom-asset-picker-dialog";
import { EcomImagePreviewHost, useEcomImagePreview } from "@/components/media";
import { EcomRefUploadCard } from "@/components/media/ecom-ref-upload-card";
import { EcomModelLibraryPickerDialog } from "@/components/model-shot/ecom-model-library-picker-dialog";
import { ModelShotRefGenerateDialog } from "@/components/model-shot/model-shot-ref-generate-dialog";
import { VtonFourViewGenerateDialog } from "@/components/vton/vton-four-view-generate-dialog";
import { VtonModelWorkbenchPanel } from "@/components/vton/vton-model-workbench-panel";
import { VtonGarmentPoolPanel } from "@/components/vton/vton-garment-pool-panel";
import { appendLookDraft, VtonLookComposer } from "@/components/vton/vton-look-composer";
import { VtonResultsGrid } from "@/components/vton/vton-results-grid";
import { VtonTryonProgressStrip } from "@/components/vton/vton-tryon-progress-strip";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";
import type { OutfitGarmentMode, OutfitRefMode } from "@/lib/video-workflow/templates/outfit-v1/ui-config";
import type { WorkflowRefs } from "@/lib/video-workflow/shot-spine";
import type { VtonTryonProgress } from "@/lib/vton-tryon-progress";
import { ECOM_VTON_MODEL_ASSET_MODULE } from "@/lib/vton-model-library";
import type { VtonBatchTryonMode } from "@/components/vton/vton-results-grid";
import {
  VTON_BOTTOM_GARMENT_SCOPE,
  VTON_GARMENT_KIND_LABELS,
  VTON_GARMENT_KIND_SHORT_LABELS,
  VTON_TOP_GARMENT_SCOPE,
  type VtonGarmentKind,
  type VtonLookSpec,
  type VtonModelPipelineBusy,
  type VtonProjectMeta,
} from "@/lib/vton-types";
import { activeTryonModelBodyHint } from "@/lib/vton-model-generation-body-check";
import {
  modelGenerationLabel,
  resolveActiveModelGeneration,
  resolveConfirmedModelGenerations,
  sortModelGenerationsNewestFirst,
} from "@/lib/vton-model-generations";
import { filterAvailableGarmentPool } from "@/lib/vton-garment-pool";
import {
  coerceVtonModelImageSize,
  type VtonModelImageSize,
} from "@/lib/vton-image-quality";
import { cn } from "@/lib/utils";

export type VtonBatchWorkflowProps = {
  meta: VtonProjectMeta;
  selectedLookIds: string[];
  onToggleLookSelection: (lookId: string) => void;
  onSelectAllLooks: () => void;
  onClearLookSelection: () => void;
  selectedResultIds: string[];
  onToggleResult: (resultId: string) => void;
  onUploadGarment: (
    kind: VtonGarmentKind,
    file: File,
    opts?: { fullSetSlot?: "composite" | "top" | "bottom"; garmentId?: string },
  ) => Promise<void>;
  onAddGarmentsFromAssets: (
    kind: VtonGarmentKind,
    assets: Array<{ ossUrl: string; title: string }>,
    opts?: { fullSetSlot?: "composite" | "top" | "bottom"; garmentId?: string },
  ) => Promise<void>;
  onRemoveGarments: (ids: string[]) => Promise<void>;
  onChangeLooks: (looks: VtonLookSpec[]) => Promise<void>;
  onCartesianLooks?: (topIds: string[], bottomIds: string[]) => Promise<void>;
  onBatchTryon: (mode: VtonBatchTryonMode) => Promise<void>;
  onRegenerateLook?: (lookId: string) => Promise<void>;
  onSaveResultToAssets?: (ossUrl: string, title: string) => Promise<void>;
  onStopBatchTryon?: () => Promise<void>;
  onLockSelected: () => Promise<void>;
  onSetDefaultLocked?: (lockedLookId: string) => Promise<void>;
  onUnlockLocked?: (lockedLookId: string) => Promise<void>;
  runningLookIds?: string[];
};

export type VtonWorkbenchMode = "outfit-video" | "model-tryon";

export type { VtonModelPipelineBusy } from "@/lib/vton-types";

type Props = {
  mode: VtonWorkbenchMode;
  refs: WorkflowRefs;
  outfitRefMode: OutfitRefMode;
  garmentMode: OutfitGarmentMode;
  refsLocked?: boolean;
  busy?: boolean;
  modelPipelineBusy?: VtonModelPipelineBusy | null;
  tryonBusy?: boolean;
  tryonProgress?: VtonTryonProgress | null;
  /** 模特试衣 · 系统内置生模特/扩全身，不展示模型选择器 */
  builtinModelPipeline?: boolean;
  vtonMeta?: VtonProjectMeta;
  onSelectPreviewModelGeneration?: (generationId: string) => Promise<void>;
  onConfirmModelGeneration?: (generationId: string) => Promise<void>;
  onSelectTryonModelGeneration?: (generationId: string) => Promise<void>;
  onUnconfirmModelGeneration?: (generationId: string) => Promise<void>;
  onSaveModelToMyModels?: (ossUrl: string, title: string) => Promise<void>;
  onDeleteModelGeneration?: (generationId: string) => Promise<void>;
  imageModels?: StoryboardGatewayModel[];
  imageModelKey?: string;
  fusionModelKey?: string;
  modelsLoading?: boolean;
  onOutfitRefModeChange: (mode: OutfitRefMode) => void;
  onGarmentModeChange: (mode: OutfitGarmentMode) => void;
  onUploadModel: (file: File) => Promise<void>;
  /** 模特工作台 · 批量上传/拖入 */
  onUploadModels?: (files: File[]) => Promise<void>;
  onUploadClothing: (file: File) => Promise<void>;
  onUploadTopGarment: (file: File) => Promise<void>;
  onUploadBottomGarment: (file: File) => Promise<void>;
  onPickModelFromLibrary: (ossUrl: string, label?: string) => Promise<void>;
  onAttachModelFromAssets?: (
    assets: Array<{ id: string; ossUrl: string; title: string }>,
  ) => Promise<void>;
  onGenerateModel: (opts?: { prompt?: string; imageSize?: string }) => Promise<void>;
  onExpandFullBody: (opts?: { prompt?: string; imageSize?: string }) => Promise<void>;
  modelImageSize?: VtonModelImageSize;
  onModelImageSizeChange?: (size: VtonModelImageSize) => void;
  onTryon: () => Promise<void>;
  onLockRefs?: () => Promise<void>;
  onSaveToAssets?: () => Promise<void>;
  saveBusy?: boolean;
  batchWorkflow?: VtonBatchWorkflowProps;
};

function modeButtonClass(active: boolean): string {
  return cn(
    "rounded-lg border px-3 py-2 text-left text-xs transition-colors",
    active
      ? "border-[#0071e3] bg-[#f0f6ff] text-[#1d1d1f]"
      : "border-[#e8e8ed] bg-white text-[#6e6e73] hover:border-[#d2d2d7]",
  );
}

export function VtonRefWorkbench({
  mode,
  refs,
  outfitRefMode,
  garmentMode,
  refsLocked = false,
  busy,
  modelPipelineBusy,
  tryonBusy,
  tryonProgress,
  builtinModelPipeline = false,
  vtonMeta,
  onSelectPreviewModelGeneration,
  onConfirmModelGeneration,
  onSelectTryonModelGeneration,
  onUnconfirmModelGeneration,
  onSaveModelToMyModels,
  onDeleteModelGeneration,
  imageModels = [],
  imageModelKey = "",
  fusionModelKey = "",
  modelsLoading,
  onOutfitRefModeChange,
  onGarmentModeChange,
  onUploadModel,
  onUploadModels,
  onUploadClothing,
  onUploadTopGarment,
  onUploadBottomGarment,
  onPickModelFromLibrary,
  onAttachModelFromAssets,
  onGenerateModel,
  onExpandFullBody,
  modelImageSize,
  onModelImageSizeChange,
  onTryon,
  onLockRefs,
  onSaveToAssets,
  saveBusy,
  batchWorkflow,
}: Props) {
  const effectiveModelImageSize = coerceVtonModelImageSize(modelImageSize);

  const [libraryOpen, setLibraryOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [genModelOpen, setGenModelOpen] = useState(false);
  const [fourViewGenOpen, setFourViewGenOpen] = useState(false);
  const [expandOpen, setExpandOpen] = useState(false);
  const [expandPrompt, setExpandPrompt] = useState("");
  const [genModelKey, setGenModelKey] = useState(imageModelKey);
  const modelFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setGenModelKey(imageModelKey);
  }, [imageModelKey]);

  const isAlreadyDressed = outfitRefMode === "already_dressed";
  const isTwoPiece = garmentMode === "two_piece";
  const useBatch = Boolean(batchWorkflow) && !isAlreadyDressed;
  const availableGarmentPool = useMemo(
    () =>
      batchWorkflow
        ? filterAvailableGarmentPool(
            batchWorkflow.meta.garmentPool ?? [],
            batchWorkflow.meta.lookDrafts ?? [],
          )
        : [],
    [batchWorkflow?.meta.garmentPool, batchWorkflow?.meta.lookDrafts],
  );
  const lockedCount = batchWorkflow?.meta.lockedLooks?.length ?? 0;
  const hasTryonPreview = useBatch
    ? lockedCount > 0 || Boolean(refs.dressedImage?.ossUrl)
    : Boolean(refs.dressedImage?.ossUrl);
  const canTryon = !isAlreadyDressed && !refsLocked && !useBatch;

  const modelItems = refs.model?.ossUrl
    ? [
        {
          id: "model",
          ossUrl: refs.model.ossUrl,
          label: refs.model.label ?? (isAlreadyDressed ? "已穿搭全身照" : "模特全身照"),
        },
      ]
    : [];

  const refPreviewItems = useMemo(() => {
    const items: Array<{ src: string; title: string; thumbSrc: string }> = [];
    const push = (url?: string, title?: string) => {
      const src = url?.trim();
      if (!src || items.some((i) => i.src === src)) return;
      items.push({ src, title: title ?? "参考图", thumbSrc: src });
    };
    push(refs.model?.ossUrl, refs.model?.label ?? "模特全身照");
    push(refs.clothing?.ossUrl, refs.clothing?.label ?? "服装");
    push(refs.topGarment?.ossUrl, refs.topGarment?.label ?? "上装");
    push(refs.bottomGarment?.ossUrl, refs.bottomGarment?.label ?? "下装");
    push(refs.dressedImage?.ossUrl, refs.dressedImage?.label ?? "试衣效果");
    for (const g of batchWorkflow?.meta.garmentPool ?? []) {
      push(g.ossUrl, g.label ?? "服装池");
    }
    return items;
  }, [refs, batchWorkflow?.meta.garmentPool]);

  const modelCandidatePreviewItems = useMemo(() => {
    const items: Array<{ src: string; title: string; thumbSrc: string }> = [];
    const list = sortModelGenerationsNewestFirst(vtonMeta?.modelGenerations ?? []);
    list.forEach((g, index) => {
      const src = g.ossUrl?.trim();
      if (!src || items.some((i) => i.src === src)) return;
      items.push({
        src,
        title: modelGenerationLabel(g, index),
        thumbSrc: src,
      });
    });
    return items;
  }, [vtonMeta?.modelGenerations]);

  const modelTryonPreviewItems = useMemo(() => {
    const items: Array<{ src: string; title: string; thumbSrc: string }> = [];
    const list = resolveConfirmedModelGenerations(vtonMeta);
    list.forEach((g, index) => {
      const src = g.ossUrl?.trim();
      if (!src || items.some((i) => i.src === src)) return;
      items.push({
        src,
        title: modelGenerationLabel(g, index),
        thumbSrc: src,
      });
    });
    return items;
  }, [vtonMeta]);

  const { preview, openPreview, closePreview, galleryItems } =
    useEcomImagePreview(refPreviewItems);

  const openRefPreview = (src: string, title: string) => {
    openPreview(src, title, refPreviewItems);
  };

  const openModelCandidatePreview = (src: string, title: string) => {
    openPreview(src, title, modelCandidatePreviewItems);
  };

  const openModelTryonPreview = (src: string, title: string) => {
    openPreview(src, title, modelTryonPreviewItems);
  };

  const genModelDisplayName = useMemo(
    () => imageModels.find((m) => m.modelKey === genModelKey)?.displayName ?? genModelKey,
    [genModelKey, imageModels],
  );

  const fusionDisplayName = useMemo(
    () => imageModels.find((m) => m.modelKey === fusionModelKey)?.displayName ?? fusionModelKey,
    [fusionModelKey, imageModels],
  );

  const modelBodyHint = useMemo(() => {
    if (!builtinModelPipeline || isAlreadyDressed || !refs.model?.ossUrl) return null;
    const active = resolveActiveModelGeneration(vtonMeta);
    return activeTryonModelBodyHint(active);
  }, [builtinModelPipeline, isAlreadyDressed, refs.model?.ossUrl, vtonMeta]);

  const sectionTitle =
    mode === "model-tryon" ? "模特试衣" : "穿搭参考";
  const sectionHint =
    mode === "model-tryon"
      ? "选择模特与服装，AI 试衣后可保存到我的资产。"
      : "锁定全片人物与服装特征；动作由参考视频驱动，无需编辑 Prompt。";

  const modelHeaderBtnClass = "h-7 px-2 text-[10px]";

  const modelGenerating = modelPipelineBusy === "generating-model";
  const modelExpanding = modelPipelineBusy === "expanding-full-body";
  const modelUploading =
    modelPipelineBusy === "uploading" || modelPipelineBusy === "importing-model";
  const modelUploadProgressLabel =
    modelPipelineBusy === "importing-model" ? "正在导入模特…" : "正在上传模特…";

  const modelHeaderActions =
    !isAlreadyDressed ? (
      <>
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={busy || refsLocked}
          className={modelHeaderBtnClass}
          onClick={() => {
            if (builtinModelPipeline) {
              setFourViewGenOpen(true);
              return;
            }
            setGenModelOpen(true);
          }}
        >
          {modelGenerating ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3 shrink-0" />
          )}
          {modelGenerating ? "生成中…" : "AI 生模特"}
        </EcomButtonSecondary>
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={busy || refsLocked || !refs.model?.ossUrl}
          className={modelHeaderBtnClass}
          onClick={() => {
            if (builtinModelPipeline) {
              void onExpandFullBody({ imageSize: effectiveModelImageSize });
              return;
            }
            setExpandOpen(true);
          }}
        >
          {modelExpanding ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : null}
          {modelExpanding ? "扩全身中…" : "头像生成全身图"}
        </EcomButtonSecondary>
        <EcomButtonSecondary
          size="sm"
          type="button"
          disabled={busy || refsLocked || modelUploading}
          className={modelHeaderBtnClass}
          onClick={() => setLibraryOpen(true)}
        >
          {modelPipelineBusy === "importing-model" ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
          ) : (
            <UserRound className="h-3 w-3 shrink-0" />
          )}
          {modelPipelineBusy === "importing-model" ? "导入中…" : "模特库"}
        </EcomButtonSecondary>
      </>
    ) : null;

  return (
    <>
    <section className="space-y-4 rounded-xl border border-[#e8e8ed] bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-[#1d1d1f]">{sectionTitle}</h2>
        <p className="mt-1 text-xs text-[#6e6e73]">{sectionHint}</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          className={modeButtonClass(isAlreadyDressed)}
          disabled={busy || tryonBusy || refsLocked}
          onClick={() => onOutfitRefModeChange("already_dressed")}
        >
          <span className="font-medium text-[#1d1d1f]">已穿搭</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed">
            上传 1 张已穿好目标服装的全身照，无需试衣。
          </span>
        </button>
        <button
          type="button"
          className={modeButtonClass(!isAlreadyDressed)}
          disabled={busy || tryonBusy || refsLocked}
          onClick={() => onOutfitRefModeChange("need_tryon")}
        >
          <span className="font-medium text-[#1d1d1f]">需穿衣</span>
          <span className="mt-0.5 block text-[11px] leading-relaxed">
            上传模特全身照与服装，AI 试衣合成穿搭图。
          </span>
        </button>
      </div>

      {!isAlreadyDressed ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-[11px]",
              isTwoPiece
                ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                : "border-[#e8e8ed] text-[#6e6e73]",
            )}
            disabled={busy || tryonBusy || refsLocked}
            onClick={() => onGarmentModeChange("two_piece")}
          >
            上下装
          </button>
          <button
            type="button"
            className={cn(
              "rounded-full border px-3 py-1 text-[11px]",
              !isTwoPiece
                ? "border-[#0071e3] bg-[#f0f6ff] text-[#0071e3]"
                : "border-[#e8e8ed] text-[#6e6e73]",
            )}
            disabled={busy || tryonBusy || refsLocked}
            onClick={() => onGarmentModeChange("one_piece")}
          >
            连体 / 单件
          </button>
        </div>
      ) : null}

      <div
        className={cn(
          "grid gap-4",
          isAlreadyDressed || useBatch
            ? "md:grid-cols-1"
            : isTwoPiece
              ? "md:grid-cols-3"
              : "md:grid-cols-2",
        )}
      >
        {isAlreadyDressed ? (
          <div className="space-y-2">
            <span className="text-xs font-medium text-[#6e6e73]">已穿搭全身照</span>
            <EcomRefUploadCard
              title="已穿搭"
              items={modelItems}
              emptyHint={`单人正面全身照，已穿好目标服装。${IMAGE_UPLOAD_DROP_HINT}`}
              accept="image/*"
              busy={busy}
              onPreviewItem={(item) => openRefPreview(item.ossUrl, item.label)}
              onUploadFiles={(files) => {
                const f = files[0];
                if (f) void onUploadModel(f);
              }}
              onOpenFilePicker={() => modelFileInputRef.current?.click()}
              inputRef={modelFileInputRef}
            />
          </div>
        ) : builtinModelPipeline && vtonMeta ? (
          <VtonModelWorkbenchPanel
            meta={vtonMeta}
            busy={busy}
            refsLocked={refsLocked}
            modelPipelineBusy={modelPipelineBusy}
            onUploadModels={
              onUploadModels ??
              (async (files) => {
                for (const file of files) {
                  await onUploadModel(file);
                }
              })
            }
            onOpenAssetPicker={
              onAttachModelFromAssets ? () => setAssetPickerOpen(true) : undefined
            }
            onOpenModelLibrary={() => setLibraryOpen(true)}
            onGenerateModel={() => setFourViewGenOpen(true)}
            onExpandFullBody={() =>
              void onExpandFullBody({ imageSize: effectiveModelImageSize })
            }
            onSelectPreview={(id) => void onSelectPreviewModelGeneration?.(id)}
            onConfirmGeneration={(id) => void onConfirmModelGeneration?.(id)}
            onSelectTryonGeneration={(id) => void onSelectTryonModelGeneration?.(id)}
            onUnconfirmGeneration={(id) => void onUnconfirmModelGeneration?.(id)}
            onPreviewCandidate={(src, title) => openModelCandidatePreview(src, title)}
            onPreviewTryon={(src, title) => openModelTryonPreview(src, title)}
            onSaveToMyModels={(ossUrl, title) => void onSaveModelToMyModels?.(ossUrl, title)}
            onDeleteGeneration={(id) => void onDeleteModelGeneration?.(id)}
            modelImageSize={effectiveModelImageSize}
            onModelImageSizeChange={(size) => onModelImageSizeChange?.(size)}
          />
        ) : (
          <div className="space-y-2">
            <span className="text-xs font-medium text-[#6e6e73]">模特全身照</span>
            <EcomRefUploadCard
              title="模特"
              items={modelItems}
              emptyHint={`单人正面全身素模照；头像/半身可点「生成全身图」。${IMAGE_UPLOAD_DROP_HINT}`}
              accept="image/*"
              busy={busy}
              showUploadProgress={modelUploading}
              uploadProgress={null}
              uploadProgressLabel={modelUploadProgressLabel}
              generating={modelGenerating || modelExpanding}
              generatingLabel={
                modelExpanding ? "头像扩全身生成中…" : modelGenerating ? "AI 生成模特中…" : undefined
              }
              onPreviewItem={(item) => openRefPreview(item.ossUrl, item.label)}
              onUploadFiles={(files) => {
                const f = files[0];
                if (f) void onUploadModel(f);
              }}
              onOpenFilePicker={() => modelFileInputRef.current?.click()}
              onOpenAssetPicker={
                onAttachModelFromAssets ? () => setAssetPickerOpen(true) : undefined
              }
              headerActions={modelHeaderActions}
              inputRef={modelFileInputRef}
            />
            {modelBodyHint ? (
              <p
                className={cn(
                  "text-[11px] leading-relaxed",
                  modelBodyHint?.startsWith("已就绪") ? "text-[#248a3d]" : "text-[#b45309]",
                )}
              >
                {modelBodyHint}
              </p>
            ) : null}
          </div>
        )}

        {!useBatch && !isAlreadyDressed && isTwoPiece ? (
          <>
            <GarmentSlot
              label={VTON_GARMENT_KIND_LABELS.top}
              title={VTON_GARMENT_KIND_LABELS.top}
              items={
                refs.topGarment?.ossUrl
                  ? [
                      {
                        id: "top",
                        ossUrl: refs.topGarment.ossUrl,
                        label: refs.topGarment.label ?? VTON_GARMENT_KIND_SHORT_LABELS.top,
                      },
                    ]
                  : []
              }
              hint={`上传上装平铺/上身图（${VTON_TOP_GARMENT_SCOPE}）。${IMAGE_UPLOAD_DROP_HINT}`}
              busy={busy}
              onUpload={(f) => void onUploadTopGarment(f)}
              onPreviewItem={(item) => openRefPreview(item.ossUrl, item.label)}
            />
            <GarmentSlot
              label={VTON_GARMENT_KIND_LABELS.bottom}
              title={VTON_GARMENT_KIND_LABELS.bottom}
              items={
                refs.bottomGarment?.ossUrl
                  ? [
                      {
                        id: "bottom",
                        ossUrl: refs.bottomGarment.ossUrl,
                        label: refs.bottomGarment.label ?? VTON_GARMENT_KIND_SHORT_LABELS.bottom,
                      },
                    ]
                  : []
              }
              hint={`上传下装平铺/上身图（${VTON_BOTTOM_GARMENT_SCOPE}）。${IMAGE_UPLOAD_DROP_HINT}`}
              busy={busy}
              onUpload={(f) => void onUploadBottomGarment(f)}
              onPreviewItem={(item) => openRefPreview(item.ossUrl, item.label)}
            />
          </>
        ) : null}

        {!useBatch && !isAlreadyDressed && !isTwoPiece ? (
          <GarmentSlot
            label="连体 / 单件服装"
            title="服装"
            items={
              refs.clothing?.ossUrl
                ? [{ id: "clothing", ossUrl: refs.clothing.ossUrl, label: refs.clothing.label ?? "服装图" }]
                : []
            }
            hint={`上传连体或单件服装图。${IMAGE_UPLOAD_DROP_HINT}`}
            busy={busy}
            onUpload={(f) => void onUploadClothing(f)}
            onPreviewItem={(item) => openRefPreview(item.ossUrl, item.label)}
          />
        ) : null}
      </div>

      {useBatch && batchWorkflow ? (
        <div className="space-y-3">
          <VtonGarmentPoolPanel
            pool={availableGarmentPool}
            lookCount={batchWorkflow.meta.lookDrafts?.length ?? 0}
            busy={busy}
            disabled={refsLocked}
            onUploadGarment={batchWorkflow.onUploadGarment}
            onAddFromAssets={batchWorkflow.onAddGarmentsFromAssets}
            onRemove={batchWorkflow.onRemoveGarments}
            onPreviewGarment={(g) => openRefPreview(g.ossUrl, g.label ?? "服装池")}
            onAddLook={async (kind, opts) => {
              const poolAll = batchWorkflow.meta.garmentPool ?? [];
              const looks = batchWorkflow.meta.lookDrafts ?? [];
              const next = appendLookDraft(looks, poolAll, kind, opts);
              if (next.length === looks.length) return;
              await batchWorkflow.onChangeLooks(next);
            }}
          />
          <VtonLookComposer
            looks={batchWorkflow.meta.lookDrafts ?? []}
            pool={batchWorkflow.meta.garmentPool ?? []}
            selectedLookIds={batchWorkflow.selectedLookIds}
            onToggleLookSelection={batchWorkflow.onToggleLookSelection}
            onSelectAllLooks={batchWorkflow.onSelectAllLooks}
            onClearLookSelection={batchWorkflow.onClearLookSelection}
            busy={busy}
            disabled={refsLocked}
            onChange={batchWorkflow.onChangeLooks}
            onCartesian={batchWorkflow.onCartesianLooks}
            modelImageSize={effectiveModelImageSize}
            onModelImageSizeChange={(size) => onModelImageSizeChange?.(size)}
          />
          <VtonResultsGrid
            batch={batchWorkflow.meta.tryonBatch}
            modelImageSize={effectiveModelImageSize}
            looks={batchWorkflow.meta.lookDrafts ?? []}
            selectedLookIds={batchWorkflow.selectedLookIds}
            lockedLooks={batchWorkflow.meta.lockedLooks ?? []}
            defaultLockedLookId={batchWorkflow.meta.defaultLockedLookId}
            tryonBusy={tryonBusy}
            busy={busy}
            disabled={refsLocked}
            mode={mode}
            selectedResultIds={batchWorkflow.selectedResultIds}
            onToggleResult={batchWorkflow.onToggleResult}
            onLockSelected={batchWorkflow.onLockSelected}
            onSetDefaultLocked={batchWorkflow.onSetDefaultLocked}
            onUnlockLocked={batchWorkflow.onUnlockLocked}
            onBatchTryon={batchWorkflow.onBatchTryon}
            onRegenerateLook={batchWorkflow.onRegenerateLook}
            onSaveResultToAssets={batchWorkflow.onSaveResultToAssets}
            onStopBatchTryon={batchWorkflow.onStopBatchTryon}
            runningLookIds={batchWorkflow.runningLookIds}
          />
        </div>
      ) : null}

      {!useBatch && hasTryonPreview ? (
        <div className="space-y-2">
          <span className="text-xs font-medium text-[#6e6e73]">试衣效果预览</span>
          <div className="overflow-hidden rounded-xl border border-[#e8e8ed] bg-[#fafafa]">
            <button
              type="button"
              className="mx-auto block max-h-[420px] w-full cursor-zoom-in"
              title="点击查看大图"
              onClick={() =>
                openRefPreview(refs.dressedImage!.ossUrl, refs.dressedImage!.label ?? "试衣预览")
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={refs.dressedImage!.ossUrl}
                alt="试衣预览"
                className="mx-auto max-h-[420px] w-auto object-contain"
                draggable={false}
              />
            </button>
          </div>
        </div>
      ) : null}

      <VtonTryonProgressStrip active={tryonBusy} progress={tryonProgress ?? null} />

      {refsLocked ? (
        <p className="rounded-lg border border-[#d4edda] bg-[#f6fff8] px-3 py-2 text-xs text-[#1d6f42]">
          穿搭参考已锁定，可开始逐镜生成。
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {canTryon ? (
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || tryonBusy}
            onClick={() => void onTryon()}
          >
            {hasTryonPreview ? "重新 AI 试衣" : "AI 试衣"}
          </EcomButtonPrimary>
        ) : null}

        {mode === "outfit-video" && onLockRefs && !isAlreadyDressed ? (
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={
              busy ||
              tryonBusy ||
              refsLocked ||
              (useBatch ? lockedCount < 1 : canTryon && !hasTryonPreview)
            }
            onClick={() => void onLockRefs()}
          >
            锁定已选参考{useBatch && lockedCount > 0 ? ` (${lockedCount})` : ""}
          </EcomButtonSecondary>
        ) : null}

        {mode === "outfit-video" && isAlreadyDressed && onLockRefs ? (
          <EcomButtonPrimary
            type="button"
            size="sm"
            disabled={busy || tryonBusy || refsLocked}
            onClick={() => void onLockRefs()}
          >
            锁定特征并进入逐镜生成
          </EcomButtonPrimary>
        ) : null}

        {mode === "model-tryon" && onSaveToAssets && hasTryonPreview ? (
          <EcomButtonSecondary
            type="button"
            size="sm"
            disabled={busy || tryonBusy || saveBusy}
            onClick={() => void onSaveToAssets()}
          >
            保存到我的资产
          </EcomButtonSecondary>
        ) : null}
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              <EcomModelLibraryPickerDialog
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
                closeOnPick={false}
                onPick={(entry) => onPickModelFromLibrary(entry.ossUrl, entry.name)}
              />
              {onAttachModelFromAssets ? (
                <EcomAssetPickerDialog
                  open={assetPickerOpen}
                  onOpenChange={setAssetPickerOpen}
                  defaultModule={ECOM_VTON_MODEL_ASSET_MODULE}
                  maxSelect={8}
                  onConfirm={async (assets) => {
                    setAssetPickerOpen(false);
                    if (assets.length) await onAttachModelFromAssets(assets);
                  }}
                />
              ) : null}
              {builtinModelPipeline ? (
                <VtonFourViewGenerateDialog
                  open={fourViewGenOpen}
                  onClose={() => setFourViewGenOpen(false)}
                  busy={busy}
                  onConfirm={async (opts) => {
                    setFourViewGenOpen(false);
                    await onGenerateModel({
                      prompt: opts.prompt,
                      imageSize: effectiveModelImageSize,
                    });
                  }}
                />
              ) : (
                <ModelShotRefGenerateDialog
                  open={genModelOpen}
                  onClose={() => setGenModelOpen(false)}
                  role="model"
                  modelKey={genModelKey}
                  modelDisplayName={genModelDisplayName}
                  imageModels={imageModels}
                  modelsLoading={modelsLoading}
                  busy={busy}
                  onConfirm={async (opts) => {
                    setGenModelOpen(false);
                    await onGenerateModel({
                      prompt: opts.prompt,
                      imageSize: effectiveModelImageSize,
                    });
                  }}
                />
              )}
              {!builtinModelPipeline && expandOpen ? (
                <VtonExpandFullBodyDialog
                  fusionDisplayName={fusionDisplayName}
                  prompt={expandPrompt}
                  onPromptChange={setExpandPrompt}
                  busy={busy}
                  onClose={() => setExpandOpen(false)}
                  onConfirm={async () => {
                    setExpandOpen(false);
                    await onExpandFullBody({
                      prompt: expandPrompt.trim() || undefined,
                      imageSize: effectiveModelImageSize,
                    });
                  }}
                />
              ) : null}
            </>,
            document.body,
          )
        : null}
    </section>
    <EcomImagePreviewHost preview={preview} galleryItems={galleryItems} onClose={closePreview} />
    </>
  );
}

function GarmentSlot({
  label,
  title,
  items,
  hint,
  busy,
  onUpload,
  onPreviewItem,
}: {
  label: string;
  title: string;
  items: Array<{ id: string; ossUrl: string; label: string }>;
  hint: string;
  busy?: boolean;
  onUpload: (file: File) => void;
  onPreviewItem?: (item: { id: string; ossUrl: string; label: string }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[#6e6e73]">{label}</span>
      <EcomRefUploadCard
        title={title}
        items={items}
        emptyHint={hint}
        accept="image/*"
        busy={busy}
        inputRef={fileInputRef}
        onPreviewItem={onPreviewItem}
        onUploadFiles={(files) => {
          const f = files[0];
          if (f) onUpload(f);
        }}
        onOpenFilePicker={() => fileInputRef.current?.click()}
      />
    </div>
  );
}

function VtonExpandFullBodyDialog({
  fusionDisplayName,
  prompt,
  onPromptChange,
  busy,
  onClose,
  onConfirm,
}: {
  fusionDisplayName: string;
  prompt: string;
  onPromptChange: (v: string) => void;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-md rounded-2xl border border-[#e8e8ed] bg-white p-5 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="vton-expand-title"
      >
        <h3 id="vton-expand-title" className="text-sm font-semibold text-[#1d1d1f]">
          生成全身图
        </h3>
        <p className="mt-1 text-xs text-[#6e6e73]">
          将当前模特图扩展为全身照（{fusionDisplayName}）。可追加补充描述，留空则使用默认 Prompt。
        </p>
        <textarea
          className="mt-3 min-h-[88px] w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-xs text-[#1d1d1f] outline-none focus:border-[#0071e3]"
          placeholder="可选：补充姿态、背景等描述"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          disabled={busy}
        />
        <div className="mt-4 flex justify-end gap-2">
          <EcomButtonSecondary type="button" size="sm" disabled={busy} onClick={onClose}>
            取消
          </EcomButtonSecondary>
          <EcomButtonPrimary type="button" size="sm" disabled={busy} onClick={() => void onConfirm()}>
            开始生成
          </EcomButtonPrimary>
        </div>
      </div>
    </div>,
    document.body,
  );
}
