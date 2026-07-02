"use client";

import { ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import {
  getQrAudioModelFromCatalog,
  getQrAudioVoiceFromCatalog,
  useQrAudioCatalog,
} from "@/lib/qr-audio-catalog-client";
import type { QrTemplate } from "@/lib/qr-template-types";

export type QrAdminAudioFormSlice = {
  modelKey: string;
  voiceId: string;
  audioStyleTag: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceSimilarityBoost: number;
  voiceStyleExaggeration: number;
};

type Props = {
  value: QrAdminAudioFormSlice;
  onChange: (next: QrAdminAudioFormSlice) => void;
  disabled?: boolean;
};

function AdminOptionSelect({
  label,
  display,
  options,
  value,
  onSelect,
  disabled,
}: {
  label: string;
  display: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-[var(--qr-text-muted)]">{label}</span>
      <select
        className="qr-input w-full text-sm"
        value={value}
        disabled={disabled}
        onChange={(e) => onSelect(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-[var(--qr-text-muted)]">{display}</span>
    </label>
  );
}

function AdminSlider({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 rounded-xl border px-3 py-2" style={{ borderColor: "var(--qr-border)" }}>
      <div className="flex justify-between text-xs">
        <span className="text-[var(--qr-text-muted)]">{label}</span>
        <span className="tabular-nums text-[var(--qr-text-primary)]">{value.toFixed(2)}</span>
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
    </label>
  );
}

/** 管理后台 · 声音模板字段（与前台 catalog 同源） */
export function QrAdminAudioFields({ value, onChange, disabled }: Props) {
  const { catalog, loading } = useQrAudioCatalog();
  const [styleOpen, setStyleOpen] = useState(false);

  const model = useMemo(() => {
    if (!catalog) return null;
    return getQrAudioModelFromCatalog(catalog, value.modelKey || catalog.defaults.modelKey);
  }, [catalog, value.modelKey]);

  const voice = useMemo(() => {
    if (!catalog) return null;
    return getQrAudioVoiceFromCatalog(catalog, value.voiceId || catalog.defaults.voiceId);
  }, [catalog, value.voiceId]);

  if (loading || !catalog) {
    return <div className="qr-skeleton h-40 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-3 rounded-xl border p-3" style={{ borderColor: "var(--qr-border)" }}>
      <p className="text-xs font-medium text-[var(--qr-text-primary)]">声音参数（与前台一致）</p>

      <AdminOptionSelect
        label="Audio model"
        display={model?.subtitle ?? ""}
        value={value.modelKey || catalog.defaults.modelKey}
        disabled={disabled}
        options={catalog.models.map((m) => ({
          value: m.modelKey,
          label: `${m.label} · ${m.subtitle}`,
        }))}
        onSelect={(modelKey) => onChange({ ...value, modelKey })}
      />

      <AdminOptionSelect
        label="Voice"
        display={(voice?.tags ?? []).join(" • ")}
        value={value.voiceId || catalog.defaults.voiceId}
        disabled={disabled}
        options={catalog.voices.map((v) => ({
          value: v.voiceId,
          label: `${v.label} · ${v.subtitle}`,
        }))}
        onSelect={(voiceId) => onChange({ ...value, voiceId })}
      />

      <div>
        <span className="mb-1 block text-xs text-[var(--qr-text-muted)]">风格标签</span>
        <div className="flex flex-wrap gap-1.5">
          {catalog.styleTags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, audioStyleTag: tag.id })}
              className={`rounded-full border px-2.5 py-0.5 text-[10px] ${
                (value.audioStyleTag || catalog.defaults.styleTag) === tag.id
                  ? "border-[var(--qr-brand)] text-[var(--qr-text-primary)]"
                  : "border-white/10 text-[var(--qr-text-muted)]"
              }`}
            >
              {tag.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-1 flex items-center gap-1 text-[10px] text-[var(--qr-text-muted)]"
          onClick={() => setStyleOpen((v) => !v)}
        >
          <ChevronRight className={`h-3 w-3 transition ${styleOpen ? "rotate-90" : ""}`} />
          更多
        </button>
      </div>

      <AdminSlider
        label="Speed"
        value={value.voiceSpeed ?? catalog.defaults.voiceSpeed}
        min={0.5}
        max={2}
        step={0.01}
        disabled={disabled}
        onChange={(voiceSpeed) => onChange({ ...value, voiceSpeed })}
      />
      <AdminSlider
        label="Stability"
        value={value.voiceStability ?? catalog.defaults.voiceStability}
        min={0}
        max={1}
        step={0.01}
        disabled={disabled}
        onChange={(voiceStability) => onChange({ ...value, voiceStability })}
      />
      <AdminSlider
        label="Similarity Boost"
        value={value.voiceSimilarityBoost ?? catalog.defaults.voiceSimilarityBoost}
        min={0}
        max={1}
        step={0.01}
        disabled={disabled}
        onChange={(voiceSimilarityBoost) => onChange({ ...value, voiceSimilarityBoost })}
      />
      <AdminSlider
        label="Style Exaggeration"
        value={value.voiceStyleExaggeration ?? catalog.defaults.voiceStyleExaggeration}
        min={0}
        max={1}
        step={0.01}
        disabled={disabled}
        onChange={(voiceStyleExaggeration) => onChange({ ...value, voiceStyleExaggeration })}
      />
    </div>
  );
}

export function extractAudioFieldsFromTemplate(reference?: QrTemplate["reference"]): QrAdminAudioFormSlice {
  const params = reference?.model.params ?? {};
  return {
    modelKey: reference?.model.modelKey ?? "eleven_multilingual_v2",
    voiceId: typeof params.voice_id === "string" ? params.voice_id : "khanh-tu",
    audioStyleTag: typeof params.style_tag === "string" ? params.style_tag : "ad-teaser",
    voiceSpeed: typeof params.speed === "number" ? params.speed : 1,
    voiceStability: typeof params.stability === "number" ? params.stability : 0.5,
    voiceSimilarityBoost: typeof params.similarity_boost === "number" ? params.similarity_boost : 0.75,
    voiceStyleExaggeration:
      typeof params.style_exaggeration === "number" ? params.style_exaggeration : 0,
  };
}

export function audioFieldsToModelParams(slice: QrAdminAudioFormSlice): Record<string, unknown> {
  return {
    voice_id: slice.voiceId,
    style_tag: slice.audioStyleTag,
    speed: slice.voiceSpeed,
    stability: slice.voiceStability,
    similarity_boost: slice.voiceSimilarityBoost,
    style_exaggeration: slice.voiceStyleExaggeration,
  };
}
