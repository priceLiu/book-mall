"use client";

import {
  ChevronRight,
  Clapperboard,
  ImageIcon,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useRef, useState } from "react";

import { QrImageUploadZone } from "@/components/quick-replica/qr-image-upload-zone";
import { QrModelPicker, QrModelPickerTrigger } from "@/components/quick-replica/qr-model-picker";
import { QrRefImageThumb } from "@/components/quick-replica/qr-ref-image-thumb";
import {
  getT2iModelCatalogEntry,
  QR_T2I_CATEGORY_OPTIONS,
  QR_T2I_FEATURE_FILTER_OPTIONS,
  QR_T2I_MODEL_CATALOG,
  QR_T2I_PROVIDER_OPTIONS,
} from "@/lib/qr-text-to-image-model-catalog";
import {
  FLUX2_RESOLUTIONS,
  GPT_IMAGE_1_QUALITIES,
  GPT_IMAGE_2_RESOLUTIONS,
  IMAGE_T2I_ASPECT_RATIOS,
  NANO_PRO_OUTPUT_FORMATS,
  NANO_PRO_RESOLUTIONS,
  QWEN_OUTPUT_FORMATS,
  SEEDREAM_QUALITIES,
  TEXT_TO_IMAGE_PROMPT_MAX_LENGTH,
  getTextToImageModelDef,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";

const PROMPT_MIN_HEIGHT = "min-h-[360px]";
const REF_THUMB_CLASS = "h-[68px] w-[68px]";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
  uploadingImage?: boolean;
  onUploadReferenceImages?: (files: File[]) => Promise<void>;
  onRemoveReferenceImage?: (index: number) => void;
};

function ParamRow({
  icon,
  label,
  value,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition disabled:opacity-50"
      style={{
        borderColor: "var(--qr-border)",
        background: "var(--qr-bg-elevated)",
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[var(--qr-text-primary)]">{label}</span>
        <span className="mt-0.5 block text-xs text-[var(--qr-text-muted)]">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--qr-text-muted)]" />
    </button>
  );
}

function OptionSheet({
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  title: string;
  options: readonly { value: string; label: string; hint?: string }[];
  value: string;
  onSelect: (value: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-2xl border p-2"
        style={{
          borderColor: "var(--qr-border)",
          background: "var(--qr-bg-surface)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium text-[var(--qr-text-primary)]">{title}</span>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onSelect(opt.value);
                onClose();
              }}
              className={`flex w-full flex-col rounded-xl px-4 py-3 text-left transition ${
                value === opt.value
                  ? "bg-[rgba(59,130,246,0.18)] text-[var(--qr-text-primary)]"
                  : "hover:bg-white/5 text-[var(--qr-text-secondary)]"
              }`}
            >
              <span className="text-sm font-medium">{opt.label}</span>
              {opt.hint ? (
                <span className="mt-0.5 text-xs text-[var(--qr-text-muted)]">{opt.hint}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 文生图工作区（模型 · 提示词 · 可选参考图 · 参数） */
export function QrCreateImageForm({
  draft,
  onDraftChange,
  busy,
  uploadingImage,
  onUploadReferenceImages,
  onRemoveReferenceImage,
}: Props) {
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [resolutionSheetOpen, setResolutionSheetOpen] = useState(false);
  const [aspectSheetOpen, setAspectSheetOpen] = useState(false);
  const [qualitySheetOpen, setQualitySheetOpen] = useState(false);
  const [formatSheetOpen, setFormatSheetOpen] = useState(false);

  const selectedModel = getTextToImageModelDef(draft.modelKey);
  const catalogEntry = getT2iModelCatalogEntry(draft.modelKey);
  const profile = selectedModel.paramProfile;
  const maxRefImages = selectedModel.maxRefImages;
  const refImages = draft.sceneImageUrls.filter((u) => u.trim());

  const pickModel = (modelKey: string) => {
    const meta = getTextToImageModelDef(modelKey);
    const existingRefs = draft.sceneImageUrls.filter((u) => u.trim()).slice(0, meta.maxRefImages);
    const next: QrWorkspaceDraft = {
      ...draft,
      modelKey,
      sceneImageUrls: existingRefs,
      targetImageUrl: "",
    };

    if (meta.paramProfile === "nano_pro") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.resolution = draft.resolution ?? "2K";
      next.outputFormat = draft.outputFormat ?? "png";
      next.mode = undefined;
    } else if (meta.paramProfile === "grok_t2i") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.resolution = undefined;
      next.outputFormat = undefined;
      next.mode = undefined;
      next.sceneImageUrls = [];
    } else if (meta.paramProfile === "flux2") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.resolution = draft.resolution ?? "2K";
      next.outputFormat = undefined;
      next.mode = undefined;
    } else if (meta.paramProfile === "seedream") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.mode = "defaultMode" in meta ? meta.defaultMode : "basic";
      next.resolution = undefined;
      next.outputFormat = undefined;
    } else if (meta.paramProfile === "gpt_image_2") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.resolution = draft.resolution ?? "2K";
      next.mode = undefined;
      next.outputFormat = undefined;
    } else if (meta.paramProfile === "gpt_image_1") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.mode = "defaultMode" in meta ? meta.defaultMode : "medium";
      next.resolution = undefined;
      next.outputFormat = undefined;
    } else if (meta.paramProfile === "qwen_t2i") {
      next.aspectRatio = draft.aspectRatio ?? "1:1";
      next.outputFormat = draft.outputFormat ?? "png";
      next.resolution = undefined;
      next.mode = undefined;
    }

    onDraftChange(next);
  };

  const resolutionOptions =
    profile === "nano_pro"
      ? NANO_PRO_RESOLUTIONS
      : profile === "flux2"
        ? FLUX2_RESOLUTIONS
        : profile === "gpt_image_2"
          ? GPT_IMAGE_2_RESOLUTIONS
          : [];

  const qualityOptions =
    profile === "seedream"
      ? SEEDREAM_QUALITIES
      : profile === "gpt_image_1"
        ? GPT_IMAGE_1_QUALITIES
        : [];

  const formatOptions =
    profile === "nano_pro"
      ? NANO_PRO_OUTPUT_FORMATS
      : profile === "qwen_t2i"
        ? QWEN_OUTPUT_FORMATS
        : [];

  const defaultResolution = profile === "gpt_image_2" ? "2K" : "2K";
  const resolutionLabel =
    resolutionOptions.find((r) => r.value === (draft.resolution ?? defaultResolution))?.label ??
    (draft.resolution ?? defaultResolution);
  const aspectLabel =
    IMAGE_T2I_ASPECT_RATIOS.find((r) => r.value === (draft.aspectRatio ?? "1:1"))?.label ?? "1:1";
  const qualityLabel =
    qualityOptions.find((q) => q.value === (draft.mode ?? qualityOptions[0]?.value))?.label ??
    "标准";
  const formatLabel =
    formatOptions.find((f) => f.value === (draft.outputFormat ?? "png"))?.label ?? "PNG";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <QrModelPickerTrigger
        entry={catalogEntry}
        busy={busy}
        onOpen={() => setModelSheetOpen(true)}
      />

      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <label
          htmlFor="qr-create-image-prompt"
          className="text-sm font-medium text-[var(--qr-text-primary)]"
        >
          提示词
        </label>
        <textarea
          id="qr-create-image-prompt"
          className={`qr-input qr-textarea-resizable mt-3 ${PROMPT_MIN_HEIGHT} w-full flex-1`}
          value={draft.prompt}
          maxLength={TEXT_TO_IMAGE_PROMPT_MAX_LENGTH}
          disabled={busy}
          placeholder="对所需图像的文本描述…"
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
      </section>

      {maxRefImages > 0 ? (
        <QrImageUploadZone
          className="qr-card rounded-2xl p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--qr-brand)]/40"
          disabled={busy || uploadingImage}
          onFiles={async (files) => {
            if (!files.length || !onUploadReferenceImages) return;
            await onUploadReferenceImages(files);
          }}
        >
          <h3 className="text-sm font-semibold text-[var(--qr-text-primary)]">参考图</h3>
          <p className="mt-1 text-xs text-[var(--qr-text-muted)]">
            {`可选参考图（最多 ${maxRefImages} 张）；不上传则为纯文生图`}
          </p>
          <input
            ref={multiImageInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length || !onUploadReferenceImages) return;
              await onUploadReferenceImages(files);
            }}
          />
          <div className="mt-3 flex min-h-[76px] flex-wrap items-center gap-2.5 py-0.5">
            {refImages.map((url, index) => (
              <QrRefImageThumb
                key={`${url}-${index}`}
                url={url}
                index={index}
                onRemove={
                  onRemoveReferenceImage ? () => onRemoveReferenceImage(index) : undefined
                }
              />
            ))}
            {refImages.length < maxRefImages ? (
              <button
                type="button"
                disabled={busy || uploadingImage}
                onClick={() => multiImageInputRef.current?.click()}
                className={`flex ${REF_THUMB_CLASS} shrink-0 flex-col items-center justify-center rounded-lg border border-dashed text-center transition hover:border-white/25 hover:bg-white/[0.02] disabled:opacity-50`}
                style={{ borderColor: "rgba(255,255,255,0.14)" }}
              >
                {uploadingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--qr-brand)]" />
                ) : (
                  <>
                    <Upload className="h-4 w-4 text-[var(--qr-text-muted)]" />
                    <span className="text-[9px] text-[var(--qr-text-muted)]">添加</span>
                  </>
                )}
              </button>
            ) : null}
            <span className="text-[10px] tabular-nums text-[var(--qr-text-muted)]">
              {refImages.length}/{maxRefImages}
            </span>
          </div>
        </QrImageUploadZone>
      ) : null}

      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ParamRow
            icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
            label="画幅比例"
            value={aspectLabel}
            disabled={busy}
            onClick={() => setAspectSheetOpen(true)}
          />
          {resolutionOptions.length > 0 ? (
            <ParamRow
              icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
              label="分辨率"
              value={resolutionLabel}
              disabled={busy}
              onClick={() => setResolutionSheetOpen(true)}
            />
          ) : null}
          {qualityOptions.length > 0 ? (
            <ParamRow
              icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
              label="画质"
              value={qualityLabel}
              disabled={busy}
              onClick={() => setQualitySheetOpen(true)}
            />
          ) : null}
          {formatOptions.length > 0 ? (
            <ParamRow
              icon={<ImageIcon className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
              label="输出格式"
              value={formatLabel}
              disabled={busy}
              onClick={() => setFormatSheetOpen(true)}
            />
          ) : null}
        </div>
      </section>

      <QrModelPicker
        open={modelSheetOpen}
        selectedModelKey={draft.modelKey}
        catalog={QR_T2I_MODEL_CATALOG}
        filterOptions={{
          providerOptions: QR_T2I_PROVIDER_OPTIONS,
          categoryOptions: QR_T2I_CATEGORY_OPTIONS,
          featureOptions: QR_T2I_FEATURE_FILTER_OPTIONS,
        }}
        onSelect={pickModel}
        onClose={() => setModelSheetOpen(false)}
      />

      {resolutionSheetOpen ? (
        <OptionSheet
          title="分辨率"
          options={resolutionOptions.map((r) => ({ value: r.value, label: r.label }))}
          value={draft.resolution ?? defaultResolution}
          onSelect={(resolution) => onDraftChange({ ...draft, resolution })}
          onClose={() => setResolutionSheetOpen(false)}
        />
      ) : null}

      {aspectSheetOpen ? (
        <OptionSheet
          title="画幅比例"
          options={IMAGE_T2I_ASPECT_RATIOS.map((r) => ({ value: r.value, label: r.label }))}
          value={draft.aspectRatio ?? "1:1"}
          onSelect={(aspectRatio) => onDraftChange({ ...draft, aspectRatio })}
          onClose={() => setAspectSheetOpen(false)}
        />
      ) : null}

      {qualitySheetOpen ? (
        <OptionSheet
          title="画质"
          options={qualityOptions.map((q) => ({ value: q.value, label: q.label }))}
          value={draft.mode ?? qualityOptions[0]?.value ?? "basic"}
          onSelect={(mode) => onDraftChange({ ...draft, mode })}
          onClose={() => setQualitySheetOpen(false)}
        />
      ) : null}

      {formatSheetOpen ? (
        <OptionSheet
          title="输出格式"
          options={formatOptions.map((f) => ({ value: f.value, label: f.label }))}
          value={draft.outputFormat ?? "png"}
          onSelect={(outputFormat) => onDraftChange({ ...draft, outputFormat })}
          onClose={() => setFormatSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
