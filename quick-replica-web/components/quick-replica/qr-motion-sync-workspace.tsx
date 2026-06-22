"use client";

import {
  ChevronRight,
  Clapperboard,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  Volume2,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

import {
  MOTION_SYNC_CHARACTER_ORIENTATIONS,
  MOTION_SYNC_MODELS,
  MOTION_SYNC_VIDEO_MODES,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
  onUploadImage?: (file: File) => Promise<void>;
  onUploadVideo?: (file: File) => Promise<void>;
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
  onUploadImage,
  onUploadVideo,
}: Props) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [orientationSheetOpen, setOrientationSheetOpen] = useState(false);
  const [modeSheetOpen, setModeSheetOpen] = useState(false);

  const selectedModel = modelMeta(draft.modelKey);
  const orientation =
    MOTION_SYNC_CHARACTER_ORIENTATIONS.find(
      (o) => o.value === (draft.characterOrientation ?? "video"),
    ) ?? MOTION_SYNC_CHARACTER_ORIENTATIONS[0];
  const videoMode =
    MOTION_SYNC_VIDEO_MODES.find((m) => m.value === (draft.mode ?? "std")) ??
    MOTION_SYNC_VIDEO_MODES[0];

  const hasReferenceVideo = Boolean(draft.referenceVideoUrl.trim());

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
    onDraftChange({
      ...draft,
      modelKey,
      mode: meta.defaultMode,
    });
  };

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

      {/* 角色 / 目标图上传 */}
      <section className="qr-card p-4">
        <h3 className="text-base font-semibold text-[var(--qr-text-primary)]">选择科目</h3>
        <p className="mt-1 text-xs leading-relaxed text-[var(--qr-text-muted)]">
          我们将根据您在下方选择的动作来制作这个角色的动画。
        </p>
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
          disabled={busy}
          onClick={() => imageInputRef.current?.click()}
          className="mt-4 flex w-full min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 transition hover:border-white/25 hover:bg-white/[0.02] disabled:opacity-50"
          style={{ borderColor: "rgba(255,255,255,0.14)" }}
        >
          {draft.targetImageUrl ? (
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
      </section>

      {/* 中央参考视频 */}
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
            disabled={busy}
            onClick={() => videoInputRef.current?.click()}
            className="qr-btn-secondary shrink-0 px-3 py-1.5 text-xs"
          >
            <Upload className="mr-1 inline h-3.5 w-3.5" />
            {hasReferenceVideo ? "更换" : "上传"}
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center py-2">
          <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl bg-black/80">
            {hasReferenceVideo ? (
              <video
                key={draft.referenceVideoUrl}
                src={draft.referenceVideoUrl}
                controls
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 px-4 text-center">
                <Clapperboard className="h-10 w-10 text-[var(--qr-text-muted)]" />
                <span className="text-sm text-[var(--qr-text-muted)]">暂无参考视频</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 底部参数 */}
      <section className="space-y-3">
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
