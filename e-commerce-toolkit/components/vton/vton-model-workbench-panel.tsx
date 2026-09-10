"use client";

import { Check, Images, Loader2, Plus, Sparkles, UserRound } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { EcomMediaGeneratingBusy } from "@/components/media/ecom-media-generating-busy";
import { useImageDropPaste } from "@/hooks/use-image-drop-paste";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { VtonImageQualityPicker } from "@/components/vton/vton-image-quality-picker";
import { VtonModelGenerationBadgeStack } from "@/components/vton/vton-model-generation-badge";
import { VtonModelImageHoverActions } from "@/components/vton/vton-model-image-hover-actions";
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_DROP_HINT } from "@/lib/image-upload-utils";
import { cn } from "@/lib/utils";
import {
  canConfirmModelGeneration,
  isModelGenerationConfirmed,
  modelGenerationBodyBadge,
  modelGenerationConfirmedBadge,
  modelGenerationLabel,
  previewModelBodyHint,
  resolveActiveModelGeneration,
  resolveConfirmedModelGenerations,
  resolvePreviewModelGeneration,
  sortModelGenerationsNewestFirst,
} from "@/lib/vton-model-generations";
import type { VtonModelImageSize } from "@/lib/vton-image-quality";
import type {
  VtonModelGeneration,
  VtonModelPipelineBusy,
  VtonProjectMeta,
} from "@/lib/vton-types";

type Props = {
  meta: VtonProjectMeta;
  busy?: boolean;
  refsLocked?: boolean;
  modelPipelineBusy?: VtonModelPipelineBusy | null;
  onUploadModels: (files: File[]) => Promise<void>;
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
  modelImageSize: VtonModelImageSize;
  onModelImageSizeChange: (size: VtonModelImageSize) => void;
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
  onUploadModels,
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
  modelImageSize,
  onModelImageSizeChange,
}: Props) {
  const { alert } = useDialogs();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ingestModelFiles = useCallback(
    (files: File[]) => {
      if (files.length < 1) return;
      void onUploadModels(files);
    },
    [onUploadModels],
  );
  const candidates = sortModelGenerationsNewestFirst(meta.modelGenerations ?? []);
  const confirmed = resolveConfirmedModelGenerations(meta);
  const leftSelection = resolvePreviewModelGeneration(meta);
  const tryonModel = resolveActiveModelGeneration(meta);
  const leftSelectionId = leftSelection?.id ?? meta.previewModelGenerationId;
  const tryonModelId = tryonModel?.id ?? meta.activeModelGenerationId;
  /** 中栏焦点：左栏浏览 vs 右栏待试衣点选（互不抢占，除非左栏选中变化） */
  const [centerSource, setCenterSource] = useState<"left" | "right">("left");
  /** 中栏展示版本（可与左栏 preview 选中解耦，如右栏待试衣点选时） */
  const [centerGenerationId, setCenterGenerationId] = useState<string | null>(null);
  /** 左栏点选后立即切换中栏，不等待 preview API */
  const [optimisticPreviewId, setOptimisticPreviewId] = useState<string | null>(null);
  const prevLeftSelectionIdRef = useRef(leftSelectionId);
  const prevPipelineBusyRef = useRef(modelPipelineBusy);
  const genPipelineBaselineIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (leftSelectionId !== prevLeftSelectionIdRef.current) {
      prevLeftSelectionIdRef.current = leftSelectionId;
      setCenterSource("left");
      setOptimisticPreviewId(null);
      if (leftSelectionId) setCenterGenerationId(leftSelectionId);
    }
  }, [leftSelectionId]);

  useEffect(() => {
    const prev = prevPipelineBusyRef.current;
    prevPipelineBusyRef.current = modelPipelineBusy;

    const enteringGenPipeline =
      (modelPipelineBusy === "generating-model" ||
        modelPipelineBusy === "expanding-full-body") &&
      prev !== modelPipelineBusy;
    if (enteringGenPipeline) {
      genPipelineBaselineIdRef.current = candidates[0]?.id ?? null;
    }

    const leavingGenPipeline =
      (prev === "generating-model" || prev === "expanding-full-body") &&
      modelPipelineBusy !== "generating-model" &&
      modelPipelineBusy !== "expanding-full-body";
    if (leavingGenPipeline) {
      const newest = candidates[0];
      if (newest && newest.id !== genPipelineBaselineIdRef.current) {
        setOptimisticPreviewId(newest.id);
        setCenterGenerationId(newest.id);
        setCenterSource("left");
        void onSelectPreview(newest.id);
        genPipelineBaselineIdRef.current = null;
      }
    }
  }, [modelPipelineBusy, candidates, onSelectPreview]);

  useEffect(() => {
    if (
      modelPipelineBusy === "generating-model" ||
      modelPipelineBusy === "expanding-full-body"
    ) {
      return;
    }
    const baseline = genPipelineBaselineIdRef.current;
    if (!baseline) return;
    const newest = candidates[0];
    if (newest && newest.id !== baseline) {
      setOptimisticPreviewId(newest.id);
      setCenterGenerationId(newest.id);
      setCenterSource("left");
      void onSelectPreview(newest.id);
      genPipelineBaselineIdRef.current = null;
    }
  }, [candidates, modelPipelineBusy, onSelectPreview]);

  const displayLeftSelection =
    optimisticPreviewId != null
      ? (candidates.find((g) => g.id === optimisticPreviewId) ?? leftSelection)
      : leftSelection;
  const displayLeftSelectionId = displayLeftSelection?.id ?? leftSelectionId;

  const leftSelectionHint = previewModelBodyHint(displayLeftSelection);
  const leftSelectionConfirmable =
    !!displayLeftSelection && canConfirmModelGeneration(displayLeftSelection);
  const leftSelectionConfirmed = displayLeftSelection
    ? isModelGenerationConfirmed(meta, displayLeftSelection.id)
    : false;

  const centerFromFocus =
    centerGenerationId != null
      ? (candidates.find((g) => g.id === centerGenerationId) ?? null)
      : null;
  const centerModel =
    centerSource === "right" && tryonModel
      ? tryonModel
      : (centerFromFocus ?? displayLeftSelection ?? tryonModel);
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
  /** 切换左/右栏选中时不应因 refBusy 禁用，否则连点无反馈 */
  const thumbSelectLocked =
    refsLocked || modelGenerating || modelExpanding || modelUploading;
  const thumbActionsLocked = thumbSelectLocked || busy;

  const { dragOver, dropZoneProps } = useImageDropPaste({
    enabled: !thumbSelectLocked,
    multiple: true,
    onFiles: ingestModelFiles,
    onError: (title, message) => {
      void alert({ title, message, variant: "error" });
    },
  });

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
            disabled={thumbSelectLocked || !displayLeftSelection?.ossUrl}
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

      <div className="flex justify-center">
        <VtonImageQualityPicker
          value={modelImageSize}
          onChange={onModelImageSizeChange}
          disabled={busy || refsLocked || modelGenerating || modelExpanding}
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={IMAGE_UPLOAD_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) ingestModelFiles(files);
          e.target.value = "";
        }}
      />

      <div
        {...dropZoneProps}
        className={cn(
          "flex items-start gap-3 rounded-xl border bg-[#fafafa] p-3 outline-none transition-colors",
          dragOver
            ? "border-[#0071e3] bg-[#f0f6ff] ring-1 ring-[#0071e3]/30"
            : "border-[#e8e8ed]",
        )}
      >
        <aside className={SIDE_COLUMN_CLASS}>
          <p className="text-[10px] font-medium text-[#86868b]">上传历史</p>
          {candidates.length > 0 ? (
            <div className={THUMB_LIST_CLASS}>
              {candidates.map((g, index) => (
                <ModelGenerationThumb
                  key={g.id}
                  generation={g}
                  index={index}
                  active={g.id === displayLeftSelectionId}
                  selectLocked={thumbSelectLocked}
                  actionsLocked={thumbActionsLocked}
                  onSelect={() => {
                    setOptimisticPreviewId(g.id);
                    setCenterGenerationId(g.id);
                    setCenterSource("left");
                    void onSelectPreview(g.id);
                  }}
                  allowPreview
                  onPreview={onPreviewCandidate}
                  onSaveToMyModels={onSaveToMyModels}
                  onDelete={() => void onDeleteGeneration(g.id)}
                  showConfirmedBadge
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
                  key={centerModel.id}
                  src={centerModel.ossUrl}
                  alt={centerModelLabel}
                  className="rounded-lg border border-[#e8e8ed]"
                />
                {(modelGenerating || modelExpanding) && (
                  <EcomMediaGeneratingBusy className="absolute inset-0 rounded-lg" />
                )}
                <VtonModelGenerationBadgeStack
                  badges={collectGenerationBadges(centerModel, {
                    includeConfirmed: centerSource === "left",
                  })}
                  className="pointer-events-none absolute left-2 top-2 z-[6]"
                />
                {!modelGenerating && !modelExpanding ? (
                  <VtonModelImageHoverActions
                    disabled={thumbActionsLocked}
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
                      displayLeftSelection?.id === centerModel.id
                        ? () => void onDeleteGeneration(centerModel.id)
                        : undefined
                    }
                  />
                ) : null}
              </div>

              {displayLeftSelection && !leftSelectionConfirmed ? (
                <EcomButtonPrimary
                  size="sm"
                  type="button"
                  disabled={thumbActionsLocked || !leftSelectionConfirmable}
                  className="h-8 px-3 text-[11px]"
                  onClick={() => void onConfirmGeneration(displayLeftSelection.id)}
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
                  selectLocked={thumbSelectLocked}
                  actionsLocked={thumbActionsLocked}
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

      {displayLeftSelection && !leftSelectionConfirmed && leftSelectionHint ? (
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

function collectGenerationBadges(
  generation: VtonModelGeneration | null | undefined,
  opts?: { includeConfirmed?: boolean },
) {
  if (!generation) return [];
  const badges = [];
  const body = modelGenerationBodyBadge(generation);
  if (body) badges.push(body);
  if (opts?.includeConfirmed) {
    const confirmed = modelGenerationConfirmedBadge(generation);
    if (confirmed) badges.push(confirmed);
  }
  return badges;
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
  selectLocked,
  actionsLocked,
  allowPreview = false,
  onSelect,
  onPreview,
  onSaveToMyModels,
  onDelete,
  onUnconfirm,
  showConfirmedBadge,
}: {
  generation: VtonModelGeneration;
  index: number;
  active: boolean;
  selectLocked?: boolean;
  actionsLocked?: boolean;
  allowPreview?: boolean;
  showConfirmedBadge?: boolean;
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
      disabled={selectLocked}
      className={cn(
        "group/image relative block w-full shrink-0 rounded-lg border-2 bg-white text-left transition",
        active ? "border-[#1d1d1f]" : "border-[#e8e8ed] hover:border-[#86868b]",
        selectLocked && "cursor-not-allowed opacity-60",
      )}
      onClick={onSelect}
    >
      <ModelImageFrame
        src={generation.ossUrl}
        alt={label}
        className="overflow-hidden rounded-[6px]"
      />
      <VtonModelGenerationBadgeStack
        badges={collectGenerationBadges(generation, { includeConfirmed: showConfirmedBadge })}
        className="pointer-events-none absolute left-1 top-1 z-[6] max-w-[calc(100%-8px)]"
      />
      <VtonModelImageHoverActions
        variant="thumb"
        disabled={actionsLocked}
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
