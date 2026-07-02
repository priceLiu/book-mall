"use client";

import {
  ChevronRight,
  Clapperboard,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { QrHappyHorsePromptTextarea } from "@/components/quick-replica/qr-happyhorse-prompt-textarea";
import { QrImageUploadZone } from "@/components/quick-replica/qr-image-upload-zone";
import { QrRefImageThumb } from "@/components/quick-replica/qr-ref-image-thumb";
import {
  GROK_I2V_ASPECT_RATIOS,
  GROK_I2V_DURATION_MAX,
  GROK_I2V_DURATION_MIN,
  GROK_I2V_MODES,
  GROK_I2V_RESOLUTIONS,
  HAPPYHORSE_R2V_ASPECT_RATIOS,
  HAPPYHORSE_R2V_DURATION_MAX,
  HAPPYHORSE_R2V_DURATION_MIN,
  HAPPYHORSE_R2V_RESOLUTIONS,
  KLING30_ASPECT_RATIOS,
  KLING_TURBO_ASPECT_RATIOS,
  KLING_TURBO_RESOLUTIONS,
  MOTION_SYNC_VIDEO_MODES,
  SEEDANCE20_ASPECT_RATIOS,
  SEEDANCE20_DURATION_MAX,
  SEEDANCE20_DURATION_MIN,
  SEEDANCE20_RESOLUTIONS,
  TEXT_TO_VIDEO_MODELS,
  TEXT_TO_VIDEO_PROMPT_MAX_LENGTH,
  WAN_T2V_ASPECT_RATIOS,
  WAN_T2V_DURATION_MAX,
  WAN_T2V_DURATION_MIN,
  WAN_T2V_RESOLUTIONS,
  getTextToVideoModelDef,
  textToVideoModelSupportsSound,
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

function ToggleSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-50 ${
        checked ? "bg-[var(--qr-accent-pink)]" : "bg-white/15"
      }`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

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

function DurationSlider({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{
        borderColor: "var(--qr-border)",
        background: "var(--qr-bg-elevated)",
      }}
    >
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-[var(--qr-text-primary)]">{label}</span>
        <span className="tabular-nums text-[var(--qr-text-muted)]">{value} 秒</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        className="w-full accent-[var(--qr-brand)]"
        onChange={(e) => onChange(Number.parseInt(e.target.value, 10))}
      />
      <p className="mt-1 text-xs text-[var(--qr-text-muted)]">
        {min}–{max} 秒
      </p>
    </div>
  );
}

/** 文字转视频工作区（模型 · 提示词 · 可选参考图 · 参数；无运动参考） */
export function QrTextToVideoForm({
  draft,
  onDraftChange,
  busy,
  uploadingImage,
  onUploadReferenceImages,
  onRemoveReferenceImage,
}: Props) {
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [resolutionSheetOpen, setResolutionSheetOpen] = useState(false);
  const [aspectSheetOpen, setAspectSheetOpen] = useState(false);
  const [grokModeSheetOpen, setGrokModeSheetOpen] = useState(false);

  const selectedModel = getTextToVideoModelDef(draft.modelKey);
  const profile = selectedModel.paramProfile;
  const usesImageTokens = "usesImageTokens" in selectedModel && selectedModel.usesImageTokens;
  const supportsSound = textToVideoModelSupportsSound(draft.modelKey);
  const soundOn =
    profile === "kling30"
      ? draft.keepOriginalSound !== false
      : draft.keepOriginalSound === true;
  const maxRefImages = selectedModel.maxRefImages;

  const refImages = draft.sceneImageUrls.filter((u) => u.trim());
  const imageRefs = useMemo(
    () => refImages.map((url, index) => ({ url, index: index + 1 })),
    [refImages],
  );

  const pickModel = (modelKey: string) => {
    const meta = getTextToVideoModelDef(modelKey);
    const existingRefs = draft.sceneImageUrls.filter((u) => u.trim()).slice(0, meta.maxRefImages);
    const next: QrWorkspaceDraft = {
      ...draft,
      modelKey,
      sceneImageUrls: existingRefs,
      targetImageUrl: "",
    };

    if (meta.paramProfile === "happyhorse_r2v") {
      next.resolution = draft.resolution ?? "1080p";
      next.aspectRatio = draft.aspectRatio ?? "16:9";
      next.duration = draft.duration ?? 5;
      next.mode = undefined;
    } else if (meta.paramProfile === "grok_i2v") {
      next.mode = "defaultMode" in meta ? meta.defaultMode : "normal";
      next.duration = draft.duration ?? 6;
      next.resolution = draft.resolution ?? "720p";
      next.aspectRatio = draft.aspectRatio ?? "16:9";
    } else if (meta.paramProfile === "kling30") {
      next.mode = "defaultMode" in meta ? meta.defaultMode : "pro";
      next.aspectRatio = draft.aspectRatio ?? "16:9";
      next.duration = draft.duration ?? 5;
      next.keepOriginalSound = draft.keepOriginalSound ?? true;
    } else if (meta.paramProfile === "kling_turbo") {
      next.resolution = draft.resolution ?? "720p";
      next.aspectRatio = draft.aspectRatio ?? "16:9";
      next.duration = draft.duration ?? 5;
      next.mode = undefined;
    } else if (meta.paramProfile === "wan_t2v") {
      next.resolution = draft.resolution ?? "1080p";
      next.aspectRatio = draft.aspectRatio ?? "16:9";
      next.duration = draft.duration ?? 5;
      next.mode = undefined;
    } else if (meta.paramProfile === "seedance20") {
      next.resolution = draft.resolution ?? "1080p";
      next.aspectRatio = draft.aspectRatio ?? "16:9";
      next.duration = draft.duration ?? 5;
      next.keepOriginalSound = draft.keepOriginalSound ?? false;
      next.mode = undefined;
    }

    onDraftChange(next);
  };

  const grokMode =
    GROK_I2V_MODES.find((m) => m.value === (draft.mode ?? "normal")) ?? GROK_I2V_MODES[0];
  const videoMode =
    MOTION_SYNC_VIDEO_MODES.find((m) => m.value === (draft.mode ?? "pro")) ??
    MOTION_SYNC_VIDEO_MODES[1];

  const resolutionOptions =
    profile === "seedance20"
      ? SEEDANCE20_RESOLUTIONS
      : profile === "grok_i2v"
      ? GROK_I2V_RESOLUTIONS
      : profile === "kling_turbo"
        ? KLING_TURBO_RESOLUTIONS
        : profile === "wan_t2v"
          ? WAN_T2V_RESOLUTIONS
          : HAPPYHORSE_R2V_RESOLUTIONS;

  const aspectOptions =
    profile === "seedance20"
      ? SEEDANCE20_ASPECT_RATIOS
      : profile === "grok_i2v"
      ? GROK_I2V_ASPECT_RATIOS
      : profile === "kling30"
        ? KLING30_ASPECT_RATIOS
        : profile === "kling_turbo"
          ? KLING_TURBO_ASPECT_RATIOS
        : profile === "wan_t2v"
          ? WAN_T2V_ASPECT_RATIOS
          : HAPPYHORSE_R2V_ASPECT_RATIOS;

  const defaultResolution =
    profile === "grok_i2v" || profile === "kling_turbo"
      ? "720p"
      : "1080p";
  const resolutionLabel =
    resolutionOptions.find((r) => r.value === (draft.resolution ?? defaultResolution))?.label ??
    defaultResolution.toUpperCase();
  const aspectLabel =
    aspectOptions.find((r) => r.value === (draft.aspectRatio ?? "16:9"))?.label ?? "16:9";

  const durationBounds =
    profile === "seedance20"
      ? { min: SEEDANCE20_DURATION_MIN, max: SEEDANCE20_DURATION_MAX, fallback: 5 }
      : profile === "happyhorse_r2v"
      ? { min: HAPPYHORSE_R2V_DURATION_MIN, max: HAPPYHORSE_R2V_DURATION_MAX, fallback: 5 }
      : profile === "grok_i2v"
        ? { min: GROK_I2V_DURATION_MIN, max: GROK_I2V_DURATION_MAX, fallback: 6 }
        : profile === "wan_t2v"
          ? { min: WAN_T2V_DURATION_MIN, max: WAN_T2V_DURATION_MAX, fallback: 5 }
          : { min: 3, max: 15, fallback: 5 };

  const durationValue = Math.min(
    durationBounds.max,
    Math.max(durationBounds.min, draft.duration ?? durationBounds.fallback),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <button
        type="button"
        onClick={() => setModelSheetOpen(true)}
        disabled={busy}
        className="qr-card flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500">
          <Sparkles className="h-5 w-5 text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-[var(--qr-text-muted)]">模型</span>
          <span className="block text-sm font-medium text-[var(--qr-text-primary)]">
            {selectedModel.label}
          </span>
          <span className="block text-xs text-[var(--qr-text-secondary)]">
            {selectedModel.subtitle}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--qr-text-muted)]" />
      </button>

      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <label
          htmlFor="qr-text-to-video-prompt"
          className="text-sm font-medium text-[var(--qr-text-primary)]"
        >
          提示词
        </label>
        {usesImageTokens ? (
          <QrHappyHorsePromptTextarea
            id="qr-text-to-video-prompt"
            value={draft.prompt}
            maxLength={TEXT_TO_VIDEO_PROMPT_MAX_LENGTH}
            disabled={busy}
            referenceImages={imageRefs}
            minHeightClass={PROMPT_MIN_HEIGHT}
            onChange={(prompt) => onDraftChange({ ...draft, prompt })}
          />
        ) : (
          <textarea
            id="qr-text-to-video-prompt"
            className={`qr-input qr-textarea-resizable mt-3 ${PROMPT_MIN_HEIGHT} w-full flex-1`}
            value={draft.prompt}
            maxLength={TEXT_TO_VIDEO_PROMPT_MAX_LENGTH}
            disabled={busy}
            placeholder="对所需输出的文本描述…"
            onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
          />
        )}
      </section>

      {maxRefImages > 0 ? (
        <QrImageUploadZone
          className="qr-card p-3 outline-none focus-visible:ring-2 focus-visible:ring-[var(--qr-brand)]/40 rounded-2xl"
          disabled={busy || uploadingImage}
          onFiles={async (files) => {
            if (!files.length || !onUploadReferenceImages) return;
            await onUploadReferenceImages(files);
          }}
        >
          <h3 className="text-sm font-semibold text-[var(--qr-text-primary)]">选择科目</h3>
          <p className="mt-1 text-xs text-[var(--qr-text-muted)]">
            {usesImageTokens
              ? "上传参考图（HappyHorse 必填），在提示词中用 @ 引用 [Image N]"
              : `可选参考图（最多 ${maxRefImages} 张）；不上传则为纯文生视频`}
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
        {supportsSound ? (
          <div
            className="flex items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              borderColor: "var(--qr-border)",
              background: "var(--qr-bg-elevated)",
            }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <Volume2 className="h-5 w-5 text-[var(--qr-text-secondary)]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-[var(--qr-text-primary)]">生成音频</span>
              <span className="mt-0.5 block text-xs text-[var(--qr-text-muted)]">
                {soundOn ? "开" : "关"}
              </span>
            </span>
            <ToggleSwitch
              checked={soundOn}
              disabled={busy}
              onChange={(keepOriginalSound) =>
                onDraftChange({ ...draft, keepOriginalSound })
              }
            />
          </div>
        ) : null}

        {profile === "seedance20" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParamRow
                icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="分辨率"
                value={resolutionLabel}
                disabled={busy}
                onClick={() => setResolutionSheetOpen(true)}
              />
              <ParamRow
                icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="画幅比例"
                value={aspectLabel}
                disabled={busy}
                onClick={() => setAspectSheetOpen(true)}
              />
            </div>
            <DurationSlider
              label="时长"
              value={durationValue}
              min={durationBounds.min}
              max={durationBounds.max}
              disabled={busy}
              onChange={(duration) => onDraftChange({ ...draft, duration })}
            />
          </>
        ) : null}

        {profile === "grok_i2v" ? (
          <>
            <ParamRow
              icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
              label="风格模式"
              value={grokMode.label}
              disabled={busy}
              onClick={() => setGrokModeSheetOpen(true)}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParamRow
                icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="分辨率"
                value={resolutionLabel}
                disabled={busy}
                onClick={() => setResolutionSheetOpen(true)}
              />
              <ParamRow
                icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="画幅比例"
                value={aspectLabel}
                disabled={busy}
                onClick={() => setAspectSheetOpen(true)}
              />
            </div>
            <DurationSlider
              label="时长"
              value={durationValue}
              min={durationBounds.min}
              max={durationBounds.max}
              disabled={busy}
              onChange={(duration) => onDraftChange({ ...draft, duration })}
            />
          </>
        ) : null}

        {profile === "kling_turbo" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParamRow
                icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="分辨率"
                value={resolutionLabel}
                disabled={busy}
                onClick={() => setResolutionSheetOpen(true)}
              />
              <ParamRow
                icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="画幅比例"
                value={aspectLabel}
                disabled={busy}
                onClick={() => setAspectSheetOpen(true)}
              />
            </div>
            <DurationSlider
              label="时长"
              value={durationValue}
              min={durationBounds.min}
              max={durationBounds.max}
              disabled={busy}
              onChange={(duration) => onDraftChange({ ...draft, duration })}
            />
          </>
        ) : null}

        {profile === "kling30" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParamRow
                icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="视频模式"
                value={videoMode.label}
                disabled={busy}
                onClick={() => setModeSheetOpen(true)}
              />
              <ParamRow
                icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="画幅比例"
                value={aspectLabel}
                disabled={busy}
                onClick={() => setAspectSheetOpen(true)}
              />
            </div>
            <DurationSlider
              label="时长"
              value={durationValue}
              min={durationBounds.min}
              max={durationBounds.max}
              disabled={busy}
              onChange={(duration) => onDraftChange({ ...draft, duration })}
            />
          </>
        ) : null}

        {profile === "happyhorse_r2v" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParamRow
                icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="分辨率"
                value={resolutionLabel}
                disabled={busy}
                onClick={() => setResolutionSheetOpen(true)}
              />
              <ParamRow
                icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="画幅比例"
                value={aspectLabel}
                disabled={busy}
                onClick={() => setAspectSheetOpen(true)}
              />
            </div>
            <DurationSlider
              label="时长"
              value={durationValue}
              min={durationBounds.min}
              max={durationBounds.max}
              disabled={busy}
              onChange={(duration) => onDraftChange({ ...draft, duration })}
            />
          </>
        ) : null}

        {profile === "wan_t2v" ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ParamRow
                icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="分辨率"
                value={resolutionLabel}
                disabled={busy}
                onClick={() => setResolutionSheetOpen(true)}
              />
              <ParamRow
                icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
                label="画幅比例"
                value={aspectLabel}
                disabled={busy}
                onClick={() => setAspectSheetOpen(true)}
              />
            </div>
            <DurationSlider
              label="时长"
              value={durationValue}
              min={durationBounds.min}
              max={durationBounds.max}
              disabled={busy}
              onChange={(duration) => onDraftChange({ ...draft, duration })}
            />
          </>
        ) : null}
      </section>

      {modelSheetOpen ? (
        <OptionSheet
          title="选择模型"
          options={TEXT_TO_VIDEO_MODELS.map((m) => ({
            value: m.modelKey,
            label: `${m.label} · ${m.subtitle}`,
            hint:
              m.maxRefImages > 0
                ? `最多 ${m.maxRefImages} 张参考图（可选）`
                : "纯文生视频",
          }))}
          value={draft.modelKey}
          onSelect={pickModel}
          onClose={() => setModelSheetOpen(false)}
        />
      ) : null}

      {modeSheetOpen ? (
        <OptionSheet
          title="视频模式"
          options={MOTION_SYNC_VIDEO_MODES.map((m) => ({
            value: m.value,
            label: m.label,
            hint: m.hint,
          }))}
          value={draft.mode ?? "pro"}
          onSelect={(mode) => onDraftChange({ ...draft, mode })}
          onClose={() => setModeSheetOpen(false)}
        />
      ) : null}

      {grokModeSheetOpen ? (
        <OptionSheet
          title="风格模式"
          options={GROK_I2V_MODES.map((m) => ({ value: m.value, label: m.label }))}
          value={draft.mode ?? "normal"}
          onSelect={(mode) => onDraftChange({ ...draft, mode })}
          onClose={() => setGrokModeSheetOpen(false)}
        />
      ) : null}

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
          options={aspectOptions.map((r) => ({ value: r.value, label: r.label }))}
          value={draft.aspectRatio ?? "16:9"}
          onSelect={(aspectRatio) => onDraftChange({ ...draft, aspectRatio })}
          onClose={() => setAspectSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
