"use client";

import {
  ChevronRight,
  Clapperboard,
  Loader2,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  HAPPYHORSE_R2V_ASPECT_RATIOS,
  HAPPYHORSE_R2V_DURATION_MAX,
  HAPPYHORSE_R2V_DURATION_MIN,
  HAPPYHORSE_R2V_MAX_REFS,
  HAPPYHORSE_R2V_RESOLUTIONS,
  isHappyHorseR2vModel,
  MOTION_SYNC_CHARACTER_ORIENTATIONS,
  MOTION_SYNC_MODELS,
  MOTION_SYNC_PROMPT_MAX_LENGTH,
  MOTION_SYNC_VIDEO_MODES,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";
import { QrHappyHorsePromptTextarea } from "@/components/quick-replica/qr-happyhorse-prompt-textarea";

/** HappyHorse 参考图缩略边长（较 h-14 高约 20%） */
const HH_REF_THUMB_CLASS = "h-[68px] w-[68px]";

function HappyHorseRefImageThumb({
  url,
  index,
  onRemove,
}: {
  url: string;
  index: number;
  onRemove?: () => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<{ left: number; top: number } | null>(null);

  const showPreview = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPreview({
      left: rect.left + rect.width / 2,
      top: rect.top - 10,
    });
  };

  return (
    <>
      <div
        ref={wrapRef}
        className={`group relative ${HH_REF_THUMB_CLASS} shrink-0 overflow-visible rounded-lg bg-zinc-900`}
        onMouseEnter={showPreview}
        onMouseLeave={() => setPreview(null)}
      >
        <div className="h-full w-full overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
        <span className="pointer-events-none absolute left-0.5 top-0.5 z-[1] rounded bg-black/60 px-1 py-px text-[9px] text-white">
          {index + 1}
        </span>
        {onRemove ? (
          <button
            type="button"
            className="absolute right-0.5 top-0.5 z-[2] rounded bg-black/60 p-px text-white hover:bg-red-600/80"
            onClick={onRemove}
            aria-label="移除参考图"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {preview && typeof document !== "undefined"
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[4500] -translate-x-1/2 -translate-y-full"
              style={{ left: preview.left, top: preview.top }}
            >
              <div
                className="overflow-hidden rounded-xl border shadow-2xl"
                style={{
                  borderColor: "var(--qr-border)",
                  background: "var(--qr-bg-surface)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  className="block max-h-52 max-w-52 object-contain"
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
  uploadingImage?: boolean;
  uploadingVideo?: boolean;
  onUploadImage?: (file: File) => Promise<void>;
  onUploadVideo?: (file: File) => Promise<void>;
  onUploadReferenceImages?: (files: File[]) => Promise<void>;
  onRemoveReferenceImage?: (index: number) => void;
};

function modelMeta(modelKey: string) {
  return MOTION_SYNC_MODELS.find((m) => m.modelKey === modelKey) ?? MOTION_SYNC_MODELS[0];
}

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

/** 运动同步工作区（模型 · 角色上传 · 中央参考视频 · 底部参数） */
export function QrMotionSyncForm({
  draft,
  onDraftChange,
  busy,
  uploadingImage,
  uploadingVideo,
  onUploadImage,
  onUploadVideo,
  onUploadReferenceImages,
  onRemoveReferenceImage,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const multiImageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [orientationSheetOpen, setOrientationSheetOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);
  const [resolutionSheetOpen, setResolutionSheetOpen] = useState(false);
  const [aspectSheetOpen, setAspectSheetOpen] = useState(false);

  const selectedModel = modelMeta(draft.modelKey);
  const isHappyHorse = isHappyHorseR2vModel(draft.modelKey);
  const orientation =
    MOTION_SYNC_CHARACTER_ORIENTATIONS.find(
      (o) => o.value === (draft.characterOrientation ?? "video"),
    ) ?? MOTION_SYNC_CHARACTER_ORIENTATIONS[0];
  const videoMode =
    MOTION_SYNC_VIDEO_MODES.find((m) => m.value === (draft.mode ?? "std")) ??
    MOTION_SYNC_VIDEO_MODES[0];

  const hasReferenceVideo = Boolean(draft.referenceVideoUrl.trim());
  const [referenceVideoAspect, setReferenceVideoAspect] = useState<number | null>(null);

  useEffect(() => {
    setReferenceVideoAspect(null);
  }, [draft.referenceVideoUrl]);

  const avatarPlaceholders = useMemo(
    () => [
      "from-violet-500/80 to-fuchsia-500/60",
      "from-sky-500/80 to-cyan-400/60",
      "from-amber-500/80 to-orange-400/60",
    ],
    [],
  );

  const pickModel = (modelKey: string) => {
    const meta = modelMeta(modelKey);
    if (isHappyHorseR2vModel(modelKey)) {
      const existingRefs = draft.sceneImageUrls.filter((u) => u.trim());
      const migratedRefs = (
        existingRefs.length > 0
          ? existingRefs
          : draft.targetImageUrl.trim()
            ? [draft.targetImageUrl.trim()]
            : []
      ).slice(0, HAPPYHORSE_R2V_MAX_REFS);
      onDraftChange({
        ...draft,
        modelKey,
        sceneImageUrls: migratedRefs,
        resolution: draft.resolution ?? "1080p",
        aspectRatio: draft.aspectRatio ?? "16:9",
        duration: draft.duration ?? 5,
      });
      return;
    }
    onDraftChange({
      ...draft,
      modelKey,
      mode: meta.defaultMode === "1080p" ? "pro" : meta.defaultMode,
      resolution: undefined,
      aspectRatio: undefined,
      duration: undefined,
      targetImageUrl:
        draft.targetImageUrl.trim() ||
        draft.sceneImageUrls.find((u) => u.trim()) ||
        "",
    });
  };

  const refImages = draft.sceneImageUrls.filter((u) => u.trim());
  const happyHorseImageRefs = useMemo(
    () => refImages.map((url, index) => ({ url, index: index + 1 })),
    [refImages],
  );
  const resolutionLabel =
    HAPPYHORSE_R2V_RESOLUTIONS.find((r) => r.value === (draft.resolution ?? "1080p"))
      ?.label ?? "1080P";
  const aspectLabel =
    HAPPYHORSE_R2V_ASPECT_RATIOS.find((r) => r.value === (draft.aspectRatio ?? "16:9"))
      ?.label ?? "16:9";
  const durationValue = Math.min(
    HAPPYHORSE_R2V_DURATION_MAX,
    Math.max(HAPPYHORSE_R2V_DURATION_MIN, draft.duration ?? 5),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* 模型选择 */}
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

      {/* 提示词（模板/后台录入 · 可编辑） */}
      <section className="qr-card p-4">
        <label
          htmlFor="qr-motion-sync-prompt"
          className="text-sm font-medium text-[var(--qr-text-primary)]"
        >
          提示词
        </label>
        {isHappyHorse ? (
          <QrHappyHorsePromptTextarea
            id="qr-motion-sync-prompt"
            value={draft.prompt}
            maxLength={MOTION_SYNC_PROMPT_MAX_LENGTH}
            disabled={busy}
            referenceImages={happyHorseImageRefs}
            onChange={(prompt) => onDraftChange({ ...draft, prompt })}
          />
        ) : (
          <textarea
            id="qr-motion-sync-prompt"
            className="qr-input qr-textarea-resizable mt-3 w-full"
            value={draft.prompt}
            maxLength={MOTION_SYNC_PROMPT_MAX_LENGTH}
            disabled={busy}
            placeholder="对所需输出的文本描述…"
            onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
          />
        )}
        {!isHappyHorse ? (
        <p className="mt-2 text-xs leading-relaxed text-[var(--qr-text-muted)]">
          对所需输出的文本描述。最大长度为 {MOTION_SYNC_PROMPT_MAX_LENGTH} 个字符。
          {draft.prompt.length > 0 ? (
            <span className="ml-1 tabular-nums">
              （{draft.prompt.length}/{MOTION_SYNC_PROMPT_MAX_LENGTH}）
            </span>
          ) : null}
        </p>
        ) : null}
      </section>

      {/* 选择科目 / 参考图 */}
      <section className={`qr-card ${isHappyHorse ? "p-3" : "p-4"}`}>
        <h3 className={`font-semibold text-[var(--qr-text-primary)] ${isHappyHorse ? "text-sm" : "text-base"}`}>
          选择科目
        </h3>
        {!isHappyHorse ? (
        <p className="mt-1 text-xs leading-relaxed text-[var(--qr-text-muted)]">
          我们将根据您在下方选择的动作来制作这个角色的动画。
        </p>
        ) : null}
        {isHappyHorse ? (
          <>
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
                <HappyHorseRefImageThumb
                  key={`${url}-${index}`}
                  url={url}
                  index={index}
                  onRemove={
                    onRemoveReferenceImage
                      ? () => onRemoveReferenceImage(index)
                      : undefined
                  }
                />
              ))}
              {refImages.length < HAPPYHORSE_R2V_MAX_REFS ? (
                <button
                  type="button"
                  disabled={busy || uploadingImage}
                  onClick={() => multiImageInputRef.current?.click()}
                  className={`flex ${HH_REF_THUMB_CLASS} shrink-0 flex-col items-center justify-center rounded-lg border border-dashed text-center transition hover:border-white/25 hover:bg-white/[0.02] disabled:opacity-50`}
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
                {refImages.length}/{HAPPYHORSE_R2V_MAX_REFS}
              </span>
            </div>
          </>
        ) : (
          <>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !onUploadImage) return;
            await onUploadImage(file);
          }}
        />
        <button
          type="button"
          disabled={busy || uploadingImage}
          onClick={() => imageInputRef.current?.click()}
          className="relative mt-4 flex w-full min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 transition hover:border-white/25 hover:bg-white/[0.02] disabled:opacity-50"
          style={{ borderColor: "rgba(255,255,255,0.14)" }}
        >
          {uploadingImage ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-8 w-8 animate-spin text-[var(--qr-brand)]" />
              <span className="text-sm text-[var(--qr-text-secondary)]">图片上传中…</span>
            </div>
          ) : draft.targetImageUrl ? (
            <div className="relative w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={draft.targetImageUrl}
                alt="角色"
                className="mx-auto max-h-40 rounded-xl object-contain"
              />
              <span className="mt-3 block text-xs text-[var(--qr-text-muted)]">
                点击更换角色图片
              </span>
            </div>
          ) : (
            <>
              <div className="mb-4 flex -space-x-3">
                {avatarPlaceholders.map((gradient, i) => (
                  <span
                    key={gradient}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--qr-bg-elevated)] bg-gradient-to-br ${gradient}`}
                    style={{ zIndex: 3 - i }}
                  >
                    <UserRound className="h-4 w-4 text-white/90" />
                  </span>
                ))}
              </div>
              <span className="text-sm font-medium text-[var(--qr-text-primary)]">
                添加图片或角色
              </span>
              <span className="mt-1 text-xs text-[var(--qr-text-muted)]">
                上传图片，或选择已保存的角色。
              </span>
            </>
          )}
        </button>
          </>
        )}
      </section>

      {/* 运动参考视频（模板复制 / 本地上传；与模型无关始终展示） */}
      <section className="qr-card flex flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[var(--qr-text-primary)]">
              运动参考
            </h3>
            <p className="mt-0.5 text-xs text-[var(--qr-text-muted)]">
              {hasReferenceVideo
                ? "来自模板或本地上传的动作参考"
                : "请上传或从右侧模板复制参考视频"}
            </p>
          </div>
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="hidden"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file || !onUploadVideo) return;
              await onUploadVideo(file);
            }}
          />
          <button
            type="button"
            disabled={busy || uploadingVideo}
            onClick={() => videoInputRef.current?.click()}
            className="qr-btn-secondary shrink-0 px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {uploadingVideo ? (
              <>
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                上传中
              </>
            ) : (
              <>
                <Upload className="mr-1 inline h-3.5 w-3.5" />
                {hasReferenceVideo ? "更换" : "上传"}
              </>
            )}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center py-2">
          <div
            className="relative mx-auto flex w-full max-w-[480px] items-center justify-center overflow-hidden rounded-2xl bg-black/80"
            style={
              hasReferenceVideo && referenceVideoAspect
                ? { aspectRatio: String(referenceVideoAspect) }
                : undefined
            }
          >
            {uploadingVideo ? (
              <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-[var(--qr-brand)]" />
                <span className="text-sm text-[var(--qr-text-secondary)]">视频上传中…</span>
              </div>
            ) : hasReferenceVideo ? (
              <video
                key={draft.referenceVideoUrl}
                src={draft.referenceVideoUrl}
                controls
                playsInline
                onLoadedMetadata={(e) => {
                  const el = e.currentTarget;
                  if (el.videoWidth > 0 && el.videoHeight > 0) {
                    setReferenceVideoAspect(el.videoWidth / el.videoHeight);
                  }
                }}
                className="block max-h-[min(480px,60vh)] w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[320px] w-full flex-col items-center justify-center gap-2 px-4 text-center">
                <Clapperboard className="h-10 w-10 text-[var(--qr-text-muted)]" />
                <span className="text-sm text-[var(--qr-text-muted)]">暂无参考视频</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 底部参数 */}
      <section className="space-y-3">
        {isHappyHorse ? (
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
            <div
              className="rounded-2xl border px-4 py-3"
              style={{
                borderColor: "var(--qr-border)",
                background: "var(--qr-bg-elevated)",
              }}
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--qr-text-primary)]">时长</span>
                <span className="tabular-nums text-[var(--qr-text-muted)]">{durationValue} 秒</span>
              </div>
              <input
                type="range"
                min={HAPPYHORSE_R2V_DURATION_MIN}
                max={HAPPYHORSE_R2V_DURATION_MAX}
                step={1}
                value={durationValue}
                disabled={busy}
                className="w-full accent-[var(--qr-brand)]"
                onChange={(e) =>
                  onDraftChange({ ...draft, duration: Number.parseInt(e.target.value, 10) })
                }
              />
              <p className="mt-1 text-xs text-[var(--qr-text-muted)]">
                {HAPPYHORSE_R2V_DURATION_MIN}–{HAPPYHORSE_R2V_DURATION_MAX} 秒
              </p>
            </div>
          </>
        ) : (
          <>
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
            <span className="block text-sm text-[var(--qr-text-primary)]">保留原声</span>
            <span className="mt-0.5 block text-xs text-[var(--qr-text-muted)]">
              {draft.keepOriginalSound !== false ? "开" : "关"}
            </span>
          </span>
          <ToggleSwitch
            checked={draft.keepOriginalSound !== false}
            disabled={busy}
            onChange={(keepOriginalSound) =>
              onDraftChange({ ...draft, keepOriginalSound })
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ParamRow
            icon={<SlidersHorizontal className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
            label="角色取向"
            value={orientation.label}
            disabled={busy}
            onClick={() => setOrientationSheetOpen(true)}
          />
          <ParamRow
            icon={<Clapperboard className="h-5 w-5 text-[var(--qr-text-secondary)]" />}
            label="视频模式"
            value={videoMode.label}
            disabled={busy}
            onClick={() => setModeSheetOpen(true)}
          />
        </div>
          </>
        )}
      </section>

      {modelSheetOpen ? (
        <OptionSheet
          title="选择模型"
          options={MOTION_SYNC_MODELS.map((m) => ({
            value: m.modelKey,
            label: `${m.label} · ${m.subtitle}`,
            hint: m.defaultMode === "pro" ? "默认 1080p" : "默认 720p",
          }))}
          value={draft.modelKey}
          onSelect={pickModel}
          onClose={() => setModelSheetOpen(false)}
        />
      ) : null}

      {orientationSheetOpen ? (
        <OptionSheet
          title="角色取向"
          options={MOTION_SYNC_CHARACTER_ORIENTATIONS}
          value={draft.characterOrientation ?? "video"}
          onSelect={(characterOrientation) =>
            onDraftChange({ ...draft, characterOrientation })
          }
          onClose={() => setOrientationSheetOpen(false)}
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
          value={draft.mode ?? "std"}
          onSelect={(mode) => onDraftChange({ ...draft, mode })}
          onClose={() => setModeSheetOpen(false)}
        />
      ) : null}

      {resolutionSheetOpen ? (
        <OptionSheet
          title="分辨率"
          options={HAPPYHORSE_R2V_RESOLUTIONS.map((r) => ({
            value: r.value,
            label: r.label,
          }))}
          value={draft.resolution ?? "1080p"}
          onSelect={(resolution) => onDraftChange({ ...draft, resolution })}
          onClose={() => setResolutionSheetOpen(false)}
        />
      ) : null}

      {aspectSheetOpen ? (
        <OptionSheet
          title="画幅比例"
          options={HAPPYHORSE_R2V_ASPECT_RATIOS.map((r) => ({
            value: r.value,
            label: r.label,
          }))}
          value={draft.aspectRatio ?? "16:9"}
          onSelect={(aspectRatio) => onDraftChange({ ...draft, aspectRatio })}
          onClose={() => setAspectSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}

/** @deprecated 使用 QrWorkspacePanel + QrMotionSyncForm */
export function QrMotionSyncWorkspace({
  draft,
  onDraftChange,
}: {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  onCreated?: unknown;
}) {
  return <QrMotionSyncForm draft={draft} onDraftChange={onDraftChange} />;
}
