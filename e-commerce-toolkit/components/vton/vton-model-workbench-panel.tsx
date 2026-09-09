"use client";

import { Check, Images, Loader2, Plus, Sparkles, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { VtonModelImageHoverActions } from "@/components/vton/vton-model-image-hover-actions";
import { IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";
import {
  canConfirmModelGeneration,
  isModelGenerationConfirmed,
  modelGenerationLabel,
  previewModelBodyHint,
  resolveActiveModelGeneration,
  resolveConfirmedModelGenerations,
  resolvePreviewModelGeneration,
  sortModelGenerationsNewestFirst,
} from "@/lib/vton-model-generations";
import type {
  VtonModelImageCheck,
  VtonModelGeneration,
  VtonModelPipelineBusy,
  VtonProjectMeta,
} from "@/lib/vton-types";

type Props = {
  meta: VtonProjectMeta;
  busy?: boolean;
  refsLocked?: boolean;
  modelPipelineBusy?: VtonModelPipelineBusy | null;
  modelImageCheck?: VtonModelImageCheck | null;
  onUploadModel: (file: File) => Promise<void>;
  onOpenAssetPicker?: () => void;
  onOpenModelLibrary: () => void;
  onGenerateModel: () => void;
  onExpandFullBody: () => void;
  onSelectPreview: (generationId: string) => void | Promise<void>;
  onConfirmGeneration: (generationId: string) => void | Promise<void>;
  onSelectTryonGeneration: (generationId: string) => void | Promise<void>;
  onUnconfirmGeneration: (generationId: string) => void | Promise<void>;
  /** 左栏上传历史 / 中栏左焦点：预览缩略条为全部候选 */
  onPreviewCandidate: (ossUrl: string, title: string) => void;
  /** 右栏待试衣 / 中栏试衣焦点：预览缩略条仅已确认待试衣 */
  onPreviewTryon: (ossUrl: string, title: string) => void;
  onSaveToMyModels: (ossUrl: string, title: string) => void | Promise<void>;
  onDeleteGeneration: (generationId: string) => void | Promise<void>;
};

/** 左/右栏固定同宽，缩略图 3:4 槽位（列表内 px 避免边框被 scroll 裁切） */
const THUMB_COLUMN_PX = 140;
const SIDE_COLUMN_CLASS = "flex w-[144px] min-w-[144px] shrink-0 flex-col gap-2";
const THUMB_LIST_CLASS =
  "ecom-scrollbar-thin flex max-h-[420px] flex-col gap-2.5 overflow-x-hidden overflow-y-auto px-1 py-1";
const MODEL_IMAGE_SLOT_CLASS =
  "relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden bg-white";

export function VtonModelWorkbenchPanel({
  meta,
  busy,
  refsLocked,
  modelPipelineBusy,
  modelImageCheck,
  onUploadModel,
  onOpenAssetPicker,
  onOpenModelLibrary,
  onGenerateModel,
  onExpandFullBody,
  onSelectPreview,
  onConfirmGeneration,
  onSelectTryonGeneration,
  onUnconfirmGeneration,
  onPreviewCandidate,
  onPreviewTryon,
  onSaveToMyModels,
  onDeleteGeneration,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const candidates = sortModelGenerationsNewestFirst(meta.modelGenerations ?? []);
  const confirmed = resolveConfirmedModelGenerations(meta);
  const leftSelection = resolvePreviewModelGeneration(meta);
  const tryonModel = resolveActiveModelGeneration(meta);
  const leftSelectionId = leftSelection?.id ?? meta.previewModelGenerationId;
  const tryonModelId = tryonModel?.id ?? meta.activeModelGenerationId;
  const leftSelectionHint = previewModelBodyHint(leftSelection, modelImageCheck);
  const leftSelectionConfirmable =
    !!leftSelection && canConfirmModelGeneration(leftSelection, modelImageCheck);
  const leftSelectionConfirmed = leftSelection
    ? isModelGenerationConfirmed(meta, leftSelection.id)
    : false;
  /** 中栏焦点：左栏浏览 vs 右栏待试衣点选（互不抢占，除非左栏选中变化） */
  const [centerSource, setCenterSource] = useState<"left" | "right">("left");
  const prevLeftSelectionIdRef = useRef(leftSelectionId);

  useEffect(() => {
    if (leftSelectionId !== prevLeftSelectionIdRef.current) {
      prevLeftSelectionIdRef.current = leftSelectionId;
      setCenterSource("left");
    }
  }, [leftSelectionId]);

  const centerModel =
    centerSource === "right" && tryonModel
      ? tryonModel
      : (leftSelection ?? tryonModel);
  const centerModelIndex = centerModel
    ? Math.max(0, candidates.findIndex((g) => g.id === centerModel.id))
    : 0;
  const centerModelLabel = centerModel
    ? modelGenerationLabel(centerModel, centerModelIndex)
    : "";

  const modelGenerating = modelPipelineBusy === "generating-model";
  const modelExpanding = modelPipelineBusy === "expanding-full-body";
  const modelUploading =
    modelPipelineBusy === "uploading" || modelPipelineBusy === "importing-model";

  const headerBtnClass = "h-7 px-2 text-[10px]";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-[#6e6e73]">模特全身照</span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={busy || refsLocked}
            className={headerBtnClass}
            onClick={onGenerateModel}
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
            disabled={busy || refsLocked || !leftSelection?.ossUrl}
            className={headerBtnClass}
            onClick={onExpandFullBody}
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
            className={headerBtnClass}
            onClick={onOpenModelLibrary}
          >
            {modelPipelineBusy === "importing-model" ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
            ) : (
              <UserRound className="h-3 w-3 shrink-0" />
            )}
            {modelPipelineBusy === "importing-model" ? "导入中…" : "模特库"}
          </EcomButtonSecondary>
          {onOpenAssetPicker ? (
            <EcomButtonSecondary
              size="sm"
              type="button"
              disabled={busy || refsLocked}
              className={headerBtnClass}
              onClick={onOpenAssetPicker}
            >
              <Images className="h-3 w-3 shrink-0" />
              我的资产
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            size="sm"
            type="button"
            disabled={busy || refsLocked}
            className={headerBtnClass}
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-3 w-3 shrink-0" />
            上传
          </EcomButtonSecondary>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onUploadModel(f);
          e.target.value = "";
        }}
      />

      <div className="flex items-start gap-3 rounded-xl border border-[#e8e8ed] bg-[#fafafa] p-3">
        <aside className={SIDE_COLUMN_CLASS}>
          <p className="text-[10px] font-medium text-[#86868b]">上传历史</p>
          {candidates.length > 0 ? (
            <div className={THUMB_LIST_CLASS}>
              {candidates.map((g, index) => (
                <ModelGenerationThumb
                  key={g.id}
                  generation={g}
                  index={index}
                  active={g.id === leftSelectionId}
                  disabled={busy || refsLocked}
                  onSelect={() => {
                    setCenterSource("left");
                    void onSelectPreview(g.id);
                  }}
                  allowPreview
                  onPreview={onPreviewCandidate}
                  onSaveToMyModels={onSaveToMyModels}
                  onDelete={() => void onDeleteGeneration(g.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[10px] leading-relaxed text-[#aeaeb2]">上传或生成后显示在此</p>
          )}
        </aside>

        <div className="relative min-h-[300px] min-w-0 flex-1">
          {modelUploading ? (
            <div className="absolute inset-x-0 top-0 z-[2] space-y-1 px-1">
              <div className="ecom-upload-progress ecom-upload-progress-indeterminate">
                <span />
              </div>
              <p className="text-[10px] text-[#0071e3]">
                {modelPipelineBusy === "importing-model" ? "正在导入模特…" : "正在上传模特…"}
              </p>
            </div>
          ) : null}

          {centerModel?.ossUrl ? (
            <div className="flex h-full flex-col items-center gap-2">
              <div
                className="group/image relative w-full"
                style={{ maxWidth: `min(100%, ${THUMB_COLUMN_PX * 2.6}px)` }}
              >
                <ModelImageFrame
                  src={centerModel.ossUrl}
                  alt={centerModelLabel}
                  className="rounded-lg border border-[#e8e8ed]"
                />
                {(modelGenerating || modelExpanding) && (
                  <EcomMediaGeneratingBusy className="absolute inset-0 rounded-lg" />
                )}
                {!modelGenerating && !modelExpanding ? (
                  <VtonModelImageHoverActions
                    disabled={busy || refsLocked}
                    onPreview={() =>
                      (centerSource === "right" ? onPreviewTryon : onPreviewCandidate)(
                        centerModel.ossUrl,
                        centerModelLabel,
                      )
                    }
                    onSaveToMyModels={() =>
                      void onSaveToMyModels(centerModel.ossUrl, centerModelLabel)
                    }
                    onDelete={
                      leftSelection?.id === centerModel.id
                        ? () => void onDeleteGeneration(centerModel.id)
                        : undefined
                    }
                  />
                ) : null}
              </div>

              {leftSelection && !leftSelectionConfirmed ? (
                <EcomButtonPrimary
                  size="sm"
                  type="button"
                  disabled={busy || refsLocked || !leftSelectionConfirmable}
                  className="h-8 px-3 text-[11px]"
                  onClick={() => void onConfirmGeneration(leftSelection.id)}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  确认左栏选中加入待试衣
                </EcomButtonPrimary>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[#e8e8ed] bg-white px-4 text-center">
              {(modelGenerating || modelExpanding) && (
                <div
                  className="relative overflow-hidden rounded-md border border-[#d2d2d7]"
                  style={{ width: THUMB_COLUMN_PX, height: (THUMB_COLUMN_PX * 4) / 3 }}
                >
                  <EcomMediaGeneratingBusy className="absolute inset-0" />
                </div>
              )}
              <p className="text-[11px] leading-relaxed text-[#86868b]">
                {modelGenerating || modelExpanding
                  ? modelExpanding
                    ? "头像扩全身生成中…"
                    : "AI 生成模特中…"
                  : `上传模特图，或点「AI 生模特」；头像/半身可点「头像生成全身图」。${IMAGE_UPLOAD_DROP_HINT}`}
              </p>
            </div>
          )}
        </div>

        <aside className={SIDE_COLUMN_CLASS}>
          <p className="text-[10px] font-medium text-[#86868b]">待试衣</p>
          {confirmed.length > 0 ? (
            <div className={THUMB_LIST_CLASS}>
              {confirmed.map((g, index) => (
                <ModelGenerationThumb
                  key={g.id}
                  generation={g}
                  index={index}
                  active={g.id === tryonModelId}
                  disabled={busy || refsLocked}
                  onSelect={() => {
                    setCenterSource("right");
                    void onSelectTryonGeneration(g.id);
                  }}
                  allowPreview
                  onPreview={onPreviewTryon}
                  onSaveToMyModels={onSaveToMyModels}
                  onUnconfirm={() => void onUnconfirmGeneration(g.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-[10px] leading-relaxed text-[#aeaeb2]">
              从左栏选图并确认后显示
            </p>
          )}
        </aside>
      </div>

      {leftSelection && !leftSelectionConfirmed && leftSelectionHint ? (
        <p
          className={cn(
            "text-[11px] leading-relaxed",
            leftSelectionConfirmable ? "text-[#248a3d]" : "text-[#b45309]",
          )}
        >
          左栏选中：{leftSelectionHint}
        </p>
      ) : null}
    </div>
  );
}

function ModelImageFrame({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn(MODEL_IMAGE_SLOT_CLASS, className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain object-center"
        draggable={false}
      />
    </div>
  );
}

function ModelGenerationThumb({
  generation,
  index,
  active,
  disabled,
  allowPreview = false,
  onSelect,
  onPreview,
  onSaveToMyModels,
  onDelete,
  onUnconfirm,
}: {
  generation: VtonModelGeneration;
  index: number;
  active: boolean;
  disabled?: boolean;
  allowPreview?: boolean;
  onSelect: () => void;
  onPreview: (ossUrl: string, title: string) => void;
  onSaveToMyModels: (ossUrl: string, title: string) => void | Promise<void>;
  onDelete?: () => void;
  onUnconfirm?: () => void;
}) {
  const label = modelGenerationLabel(generation, index);

  return (
    <button
      type="button"
      className={cn(
        "group/image relative block w-full shrink-0 rounded-lg border-2 bg-white text-left transition",
        active ? "border-[#1d1d1f]" : "border-[#e8e8ed] hover:border-[#86868b]",
      )}
      onClick={onSelect}
    >
      <ModelImageFrame
        src={generation.ossUrl}
        alt={label}
        className="overflow-hidden rounded-[6px]"
      />
      <VtonModelImageHoverActions
        variant="thumb"
        disabled={disabled}
        onPreview={allowPreview ? () => onPreview(generation.ossUrl, label) : undefined}
        onSaveToMyModels={() => void onSaveToMyModels(generation.ossUrl, label)}
        onDelete={onDelete ?? onUnconfirm}
      />
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] truncate rounded-b-[6px] bg-black/50 px-1 py-0.5 text-[9px] text-white">
        {label}
      </span>
    </button>
  );
}
