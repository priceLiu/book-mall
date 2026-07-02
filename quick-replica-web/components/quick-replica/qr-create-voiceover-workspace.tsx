"use client";

import {
  ChevronRight,
  Mic2,
  RefreshCw,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  getQrAudioModelFromCatalog,
  getQrAudioVoiceFromCatalog,
  useQrAudioCatalog,
} from "@/lib/qr-audio-catalog-client";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

const PROMPT_MAX = 10_000;

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
};

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
        style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-surface)" }}
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

function VoiceControlSlider({
  label,
  value,
  min,
  max,
  step,
  leftLabel,
  rightLabel,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  leftLabel: string;
  rightLabel: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      className="rounded-2xl border px-4 py-3"
      style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-elevated)" }}
    >
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-[var(--qr-text-primary)]">{label}</span>
        <span className="tabular-nums text-[var(--qr-text-muted)]">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        className="w-full accent-[var(--qr-accent-pink)]"
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
      />
      <div className="mt-1 flex justify-between text-[10px] text-[var(--qr-text-muted)]">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}

/** 旁白 / 声音工作区（Audio model · Prompt · Voice · Voice control） */
export function QrCreateVoiceoverForm({ draft, onDraftChange, busy }: Props) {
  const { catalog, loading } = useQrAudioCatalog();
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);

  const selectedModel = useMemo(() => {
    if (!catalog) return null;
    return getQrAudioModelFromCatalog(catalog, draft.modelKey);
  }, [catalog, draft.modelKey]);

  const selectedVoice = useMemo(() => {
    if (!catalog) return null;
    return getQrAudioVoiceFromCatalog(catalog, draft.voiceId ?? catalog.defaults.voiceId);
  }, [catalog, draft.voiceId]);

  const promptLength = draft.prompt.length;

  if (loading || !catalog) {
    return (
      <div className="space-y-4">
        <div className="qr-skeleton h-20 w-full rounded-2xl" />
        <div className="qr-skeleton min-h-[360px] w-full rounded-2xl" />
        <div className="qr-skeleton h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const speed = draft.voiceSpeed ?? catalog.defaults.voiceSpeed;
  const stability = draft.voiceStability ?? catalog.defaults.voiceStability;
  const similarity = draft.voiceSimilarityBoost ?? catalog.defaults.voiceSimilarityBoost;
  const exaggeration = draft.voiceStyleExaggeration ?? catalog.defaults.voiceStyleExaggeration;
  const styleTag = draft.audioStyleTag ?? catalog.defaults.styleTag;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <button
        type="button"
        onClick={() => setModelSheetOpen(true)}
        disabled={busy}
        className="qr-card flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
      >
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500">
          <Volume2 className="h-5 w-5 text-white" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-[var(--qr-text-muted)]">Audio model</span>
          <span className="block text-sm font-medium text-[var(--qr-text-primary)]">
            {selectedModel?.label}
          </span>
          <span className="block text-xs text-[var(--qr-text-secondary)]">
            {selectedModel?.subtitle}
          </span>
        </span>
        <ChevronRight className="h-5 w-5 shrink-0 text-[var(--qr-text-muted)]" />
      </button>

      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <label htmlFor="qr-voiceover-prompt" className="text-sm font-medium text-[var(--qr-text-primary)]">
            Prompt
          </label>
          <button
            type="button"
            disabled={busy || !draft.prompt}
            onClick={() => onDraftChange({ ...draft, prompt: "" })}
            className="rounded-lg p-1.5 text-[var(--qr-text-muted)] hover:bg-white/10 disabled:opacity-40"
            aria-label="清空提示词"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <textarea
          id="qr-voiceover-prompt"
          className="qr-input qr-textarea-resizable min-h-[320px] w-full flex-1"
          value={draft.prompt}
          maxLength={PROMPT_MAX}
          disabled={busy}
          placeholder="输入旁白脚本…"
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            {catalog.styleTags.map((tag) => {
              const active = styleTag === tag.id;
              return (
                <button
                  key={tag.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onDraftChange({ ...draft, audioStyleTag: tag.id })}
                  className={`rounded-full border px-3 py-1 text-[11px] transition ${
                    active
                      ? "border-[var(--qr-brand)] bg-[rgba(59,130,246,0.12)] text-[var(--qr-text-primary)]"
                      : "border-white/10 text-[var(--qr-text-muted)] hover:border-white/20"
                  }`}
                >
                  {tag.label}
                </button>
              );
            })}
            <button
              type="button"
              disabled={busy}
              className="rounded-full border border-white/10 p-1.5 text-[var(--qr-text-muted)] hover:border-white/20"
              aria-label="刷新风格"
              onClick={() =>
                onDraftChange({ ...draft, audioStyleTag: catalog.defaults.styleTag })
              }
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--qr-text-muted)]">
            {promptLength}/{PROMPT_MAX.toLocaleString()}
          </span>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">Voice</h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => setVoiceSheetOpen(true)}
          className="qr-card flex w-full items-center gap-3 p-3 text-left disabled:opacity-60"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 text-lg font-semibold text-white">
            {selectedVoice?.avatarLetter ?? "K"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-[var(--qr-text-primary)]">
              {selectedVoice?.label}
              {selectedVoice?.subtitle ? ` - ${selectedVoice.subtitle}` : ""}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[var(--qr-text-muted)]">
              {(selectedVoice?.tags ?? []).join(" • ")}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-[var(--qr-text-muted)]" />
        </button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Mic2 className="h-4 w-4 text-[var(--qr-text-muted)]" />
          <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">Voice control</h3>
        </div>
        <VoiceControlSlider
          label="Speed"
          value={speed}
          min={0.5}
          max={2}
          step={0.01}
          leftLabel="Slower"
          rightLabel="Faster"
          disabled={busy}
          onChange={(voiceSpeed) => onDraftChange({ ...draft, voiceSpeed })}
        />
        <VoiceControlSlider
          label="Stability"
          value={stability}
          min={0}
          max={1}
          step={0.01}
          leftLabel="More variable"
          rightLabel="More stable"
          disabled={busy}
          onChange={(voiceStability) => onDraftChange({ ...draft, voiceStability })}
        />
        <VoiceControlSlider
          label="Similarity Boost"
          value={similarity}
          min={0}
          max={1}
          step={0.01}
          leftLabel="Low"
          rightLabel="High"
          disabled={busy}
          onChange={(voiceSimilarityBoost) => onDraftChange({ ...draft, voiceSimilarityBoost })}
        />
        <VoiceControlSlider
          label="Style Exaggeration"
          value={exaggeration}
          min={0}
          max={1}
          step={0.01}
          leftLabel="None"
          rightLabel="Exaggerated"
          disabled={busy}
          onChange={(voiceStyleExaggeration) =>
            onDraftChange({ ...draft, voiceStyleExaggeration })
          }
        />
      </section>

      {modelSheetOpen ? (
        <OptionSheet
          title="Audio model"
          options={catalog.models.map((m) => ({
            value: m.modelKey,
            label: m.label,
            hint: m.subtitle,
          }))}
          value={draft.modelKey}
          onSelect={(modelKey) => onDraftChange({ ...draft, modelKey })}
          onClose={() => setModelSheetOpen(false)}
        />
      ) : null}

      {voiceSheetOpen ? (
        <OptionSheet
          title="Voice"
          options={catalog.voices.map((v) => ({
            value: v.voiceId,
            label: `${v.label} · ${v.subtitle}`,
            hint: (v.tags ?? []).join(" • "),
          }))}
          value={draft.voiceId ?? catalog.defaults.voiceId}
          onSelect={(voiceId) => onDraftChange({ ...draft, voiceId })}
          onClose={() => setVoiceSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
