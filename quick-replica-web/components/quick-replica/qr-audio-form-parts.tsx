"use client";

import { ChevronRight, Mic2, Volume2, X } from "lucide-react";

import { QrModelPickerTrigger } from "@/components/quick-replica/qr-model-picker";
import type { QrAudioCatalog } from "@/lib/qr-audio-catalog-client";
import {
  QR_VOICE_EMOTION_DEFS,
  QR_VOICE_EMOTION_MAX_TOTAL,
} from "@/lib/qr-audio-catalog-client";
import {
  buildAudioModelPickerCatalog,
  getAudioModelCatalogEntry,
  type QrAudioPickerKind,
} from "@/lib/qr-audio-model-picker-catalog";
import { resolveQrSelectedVoiceDisplay } from "@/lib/qr-audio-voice-selection";

export function QrAudioOptionSheet({
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
        <div className="max-h-[60vh] space-y-1 overflow-y-auto">
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

export function QrAudioModelPickerButton({
  catalog,
  modelKey,
  busy,
  onOpen,
  kind = "create-voiceover",
}: {
  catalog: QrAudioCatalog;
  modelKey: string;
  busy?: boolean;
  onOpen: () => void;
  kind?: QrAudioPickerKind;
}) {
  const pickerCatalog = buildAudioModelPickerCatalog(catalog.models, kind);
  const entry = getAudioModelCatalogEntry(pickerCatalog, modelKey);
  return (
    <QrModelPickerTrigger
      entry={entry}
      busy={busy}
      onOpen={onOpen}
      label="Audio model"
      subtitle={entry.description}
    />
  );
}

export function QrAudioVoicePickerButton({
  catalog,
  voiceId,
  busy,
  pickerActive,
  onOpenGallery,
}: {
  catalog: QrAudioCatalog;
  voiceId?: string;
  busy?: boolean;
  pickerActive?: boolean;
  onOpenGallery: () => void;
}) {
  const voice = resolveQrSelectedVoiceDisplay(catalog, voiceId);
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">Voice</h3>
      <button
        type="button"
        disabled={busy}
        onClick={onOpenGallery}
        className={`qr-card flex w-full items-center gap-3 p-3 text-left transition disabled:opacity-60 ${
          pickerActive ? "qr-voice-picker-active ring-2 ring-[var(--qr-brand)] ring-offset-2 ring-offset-[var(--qr-bg-base)]" : ""
        }`}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 via-pink-500 to-violet-500 text-lg font-semibold text-white">
          {voice.avatarLetter}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--qr-text-primary)]">
            {voice.label}
            {voice.subtitle ? ` · ${voice.subtitle}` : ""}
          </span>
          <span className="mt-0.5 block truncate text-xs text-[var(--qr-text-muted)]">
            {voice.tags.length > 0 ? voice.tags.join(" • ") : "点击在右侧音色列表中选择"}
          </span>
        </span>
        <ChevronRight
          className={`h-5 w-5 shrink-0 text-[var(--qr-text-muted)] transition ${
            pickerActive ? "translate-x-0.5 text-[var(--qr-brand)]" : ""
          }`}
        />
      </button>
      {pickerActive ? (
        <p className="qr-voice-picker-hint text-center text-[11px] text-[var(--qr-brand)]">
          请在右侧「音色列表」中选择目标音色 →
        </p>
      ) : null}
    </section>
  );
}

export function QrAudioVoiceControlHeading() {
  return (
    <div className="flex items-center gap-2">
      <Mic2 className="h-4 w-4 text-[var(--qr-text-muted)]" />
      <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">Voice control</h3>
    </div>
  );
}

export function QrAudioVoiceControlSlider({
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

export function QrAudioEmotionControlGrid({
  values,
  disabled,
  onChange,
}: {
  values: Record<string, number>;
  disabled?: boolean;
  onChange: (values: Record<string, number>) => void;
}) {
  const total = QR_VOICE_EMOTION_DEFS.reduce((sum, d) => sum + (values[d.id] ?? 0), 0);
  const totalOk = total <= QR_VOICE_EMOTION_MAX_TOTAL + 0.001;

  const setEmotion = (id: string, nextRaw: number) => {
    const nextVal = Math.max(0, Math.min(1.5, nextRaw));
    const others = QR_VOICE_EMOTION_DEFS.filter((d) => d.id !== id).reduce(
      (sum, d) => sum + (values[d.id] ?? 0),
      0,
    );
    const capped = Math.min(nextVal, Math.max(0, QR_VOICE_EMOTION_MAX_TOTAL - others));
    onChange({ ...values, [id]: Math.round(capped * 100) / 100 });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">
          3. Set Emotion Control{" "}
          <span className="text-[11px] font-normal text-[var(--qr-text-muted)]">(Optional)</span>
        </h3>
        <span
          className={`text-[11px] tabular-nums ${totalOk ? "text-emerald-400" : "text-amber-400"}`}
        >
          Total Emotion Values {total.toFixed(2)} / {QR_VOICE_EMOTION_MAX_TOTAL.toFixed(1)}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {QR_VOICE_EMOTION_DEFS.map((def) => {
          const val = values[def.id] ?? 0;
          return (
            <div
              key={def.id}
              className="rounded-2xl border px-4 py-3"
              style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-elevated)" }}
            >
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-[var(--qr-text-primary)]">{def.label}</span>
                <span className="tabular-nums text-[var(--qr-text-muted)]">{val.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.01}
                value={val}
                disabled={disabled}
                className="w-full accent-[var(--qr-accent-pink)]"
                onChange={(e) => setEmotion(def.id, Number.parseFloat(e.target.value))}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
