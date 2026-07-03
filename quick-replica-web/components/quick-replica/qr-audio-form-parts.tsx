"use client";

import { ChevronRight, Mic2, Volume2, X } from "lucide-react";

import type { QrAudioCatalog } from "@/lib/qr-audio-catalog-client";
import { getQrAudioModelFromCatalog } from "@/lib/qr-audio-catalog-client";
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
}: {
  catalog: QrAudioCatalog;
  modelKey: string;
  busy?: boolean;
  onOpen: () => void;
}) {
  const model = getQrAudioModelFromCatalog(catalog, modelKey);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      className="qr-card flex w-full items-center gap-3 p-4 text-left disabled:opacity-60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-pink-500">
        <Volume2 className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-[var(--qr-text-muted)]">Audio model</span>
        <span className="block text-sm font-medium text-[var(--qr-text-primary)]">{model.label}</span>
        <span className="block text-xs text-[var(--qr-text-secondary)]">{model.subtitle}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--qr-text-muted)]" />
    </button>
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
