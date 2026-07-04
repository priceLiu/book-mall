"use client";

import { Music2, RefreshCw, Trash2 } from "lucide-react";

import { QrAudioVoiceControlSlider } from "@/components/quick-replica/qr-audio-form-parts";
import {
  QrAudioPromptTemplatePills,
  resolveActivePromptTemplateId,
} from "@/components/quick-replica/qr-audio-prompt-template-pills";
import { useQrAudioCatalog } from "@/lib/qr-audio-catalog-client";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

const PROMPT_MAX = 10_000;

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
};

function QrToggleRow({
  label,
  subtitle,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  subtitle?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <span className="min-w-0 flex items-center gap-2">
        <Music2 className="h-4 w-4 shrink-0 text-[var(--qr-text-muted)]" />
        <span>
          <span className="block text-sm font-medium text-[var(--qr-text-primary)]">{label}</span>
          {subtitle ? (
            <span className="block text-xs text-[var(--qr-text-muted)]">{subtitle}</span>
          ) : null}
        </span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full border transition disabled:opacity-40 ${
          checked
            ? "border-[rgba(234,94,193,0.6)] bg-[rgba(234,94,193,0.35)]"
            : "border-white/15 bg-white/10"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "left-[1.05rem]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function QrAutoControlRow({
  label,
  auto,
  disabled,
  onAutoChange,
  children,
}: {
  label: string;
  auto: boolean;
  disabled?: boolean;
  onAutoChange: (auto: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-[var(--qr-text-secondary)]">{label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--qr-text-muted)]">{auto ? "Auto" : "Manual"}</span>
          <button
            type="button"
            role="switch"
            aria-checked={auto}
            disabled={disabled}
            onClick={() => onAutoChange(!auto)}
            className={`relative h-6 w-10 rounded-full border transition disabled:opacity-40 ${
              auto
                ? "border-[rgba(234,94,193,0.6)] bg-[rgba(234,94,193,0.35)]"
                : "border-white/15 bg-white/10"
            }`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                auto ? "left-[1.05rem]" : "left-0.5"
              }`}
            />
          </button>
        </div>
      </div>
      {!auto ? children : null}
    </div>
  );
}

/** 创作音乐 · Eleven Music v2（UI 不暴露模型） */
export function QrCreateMusicForm({ draft, onDraftChange, busy }: Props) {
  const { catalog, loading } = useQrAudioCatalog();

  if (loading || !catalog) {
    return <div className="qr-skeleton h-64 w-full rounded-2xl" />;
  }

  const clipMode = draft.musicClipMode ?? catalog.defaults.musicClipMode ?? "quick";
  const instrumental = draft.musicInstrumental ?? catalog.defaults.musicInstrumental ?? false;
  const durationAuto = draft.musicDurationAuto ?? catalog.defaults.musicDurationAuto ?? true;
  const durationSeconds = draft.musicDurationSeconds ?? catalog.defaults.musicDurationSeconds ?? 180;
  const bpmAuto = draft.musicBpmAuto ?? catalog.defaults.musicBpmAuto ?? true;
  const bpm = draft.musicBpm ?? catalog.defaults.musicBpm ?? 120;
  const intensityAuto = draft.musicIntensityAuto ?? catalog.defaults.musicIntensityAuto ?? true;
  const intensity = draft.musicIntensity ?? catalog.defaults.musicIntensity ?? "medium";
  const keyAuto = draft.musicKeyAuto ?? catalog.defaults.musicKeyAuto ?? true;
  const musicKey = draft.musicKey ?? catalog.defaults.musicKey ?? "C major";

  const activeTemplateId = resolveActivePromptTemplateId(
    catalog,
    "create-music",
    draft.prompt,
    draft.audioStyleTag,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex gap-2">
        {(
          [
            { id: "quick" as const, label: "Quick Clip 30s" },
            { id: "full" as const, label: "Full Song ~3 min" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            disabled={busy}
            onClick={() => onDraftChange({ ...draft, musicClipMode: tab.id })}
            className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition ${
              clipMode === tab.id
                ? "bg-[rgba(234,94,193,0.85)] text-white shadow-sm"
                : "border border-white/10 bg-white/[0.03] text-[var(--qr-text-muted)] hover:border-white/20"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <label htmlFor="qr-music-prompt" className="text-sm font-medium text-[var(--qr-text-primary)]">
            Describe your song
          </label>
          <button
            type="button"
            disabled={busy || !draft.prompt}
            onClick={() => onDraftChange({ ...draft, prompt: "" })}
            className="rounded-lg p-1.5 text-[var(--qr-text-muted)] hover:bg-white/10 disabled:opacity-40"
            aria-label="清空描述"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <textarea
          id="qr-music-prompt"
          className="qr-input qr-textarea-resizable min-h-[220px] w-full flex-1"
          value={draft.prompt}
          maxLength={PROMPT_MAX}
          disabled={busy}
          placeholder='例如 "Catchy pop song with bright acoustic guitar…"'
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <QrAudioPromptTemplatePills
            catalog={catalog}
            kind="create-music"
            activeTemplateId={activeTemplateId}
            busy={busy}
            onApply={(tpl) =>
              onDraftChange({
                ...draft,
                prompt: tpl.content,
                audioStyleTag: tpl.id,
              })
            }
          />
          <button
            type="button"
            disabled={busy}
            title="随机切换标签"
            aria-label="随机切换标签"
            onClick={() => {
              const tags = catalog.musicStyleTags ?? [];
              if (!tags.length) return;
              const idx = Math.floor(Math.random() * tags.length);
              const tpl = tags[idx]!;
              onDraftChange({
                ...draft,
                prompt: tpl.content ?? "",
                audioStyleTag: tpl.id,
              });
            }}
            className="rounded-lg p-2 text-[var(--qr-text-muted)] hover:bg-white/10 disabled:opacity-40"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </section>

      <QrToggleRow
        label="Instrumental"
        subtitle={instrumental ? "On" : "Off"}
        checked={instrumental}
        disabled={busy}
        onChange={(musicInstrumental) => onDraftChange({ ...draft, musicInstrumental })}
      />

      <section className="qr-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--qr-text-primary)]">Song Control</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[var(--qr-text-muted)]">
            Optional
          </span>
        </div>

        {clipMode === "full" ? (
          <QrAutoControlRow
            label="Duration"
            auto={durationAuto}
            disabled={busy}
            onAutoChange={(musicDurationAuto) => onDraftChange({ ...draft, musicDurationAuto })}
          >
            <QrAudioVoiceControlSlider
              label="Duration (seconds)"
              value={durationSeconds}
              min={30}
              max={600}
              step={15}
              leftLabel="30s"
              rightLabel="10m"
              disabled={busy}
              onChange={(musicDurationSeconds) => onDraftChange({ ...draft, musicDurationSeconds })}
            />
          </QrAutoControlRow>
        ) : null}

        <QrAutoControlRow
          label="BPM"
          auto={bpmAuto}
          disabled={busy}
          onAutoChange={(musicBpmAuto) => onDraftChange({ ...draft, musicBpmAuto })}
        >
          <QrAudioVoiceControlSlider
            label="BPM"
            value={bpm}
            min={60}
            max={200}
            step={1}
            leftLabel="60"
            rightLabel="200"
            disabled={busy}
            onChange={(musicBpm) => onDraftChange({ ...draft, musicBpm })}
          />
        </QrAutoControlRow>

        <QrAutoControlRow
          label="Intensity"
          auto={intensityAuto}
          disabled={busy}
          onAutoChange={(musicIntensityAuto) => onDraftChange({ ...draft, musicIntensityAuto })}
        >
          <div className="flex flex-wrap gap-2">
            {(["low", "medium", "high"] as const).map((level) => (
              <button
                key={level}
                type="button"
                disabled={busy}
                onClick={() => onDraftChange({ ...draft, musicIntensity: level })}
                className={`rounded-full border px-3 py-1 text-xs capitalize ${
                  intensity === level
                    ? "border-[var(--qr-brand)] bg-[rgba(59,130,246,0.12)]"
                    : "border-white/10 text-[var(--qr-text-muted)]"
                }`}
              >
                {level}
              </button>
            ))}
          </div>
        </QrAutoControlRow>

        <QrAutoControlRow
          label="Key"
          auto={keyAuto}
          disabled={busy}
          onAutoChange={(musicKeyAuto) => onDraftChange({ ...draft, musicKeyAuto })}
        >
          <input
            type="text"
            className="qr-input w-full"
            value={musicKey}
            disabled={busy}
            placeholder="C major"
            onChange={(e) => onDraftChange({ ...draft, musicKey: e.target.value })}
          />
        </QrAutoControlRow>
      </section>
    </div>
  );
}
