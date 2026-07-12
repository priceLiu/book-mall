"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Play, Trash2, Upload } from "lucide-react";

import {
  QrAudioEmotionControlGrid,
  QrAudioOptionSheet,
} from "@/components/quick-replica/qr-audio-form-parts";
import { HorizontalOscilloscopeWaveform } from "@/components/quick-replica/qr-audio-generate-preview";
import { QrModelPicker, QrModelPickerTrigger } from "@/components/quick-replica/qr-model-picker";
import {
  QR_VOICE_CLONE_PROMPT_MAX,
  getQrVoiceCloneModelsFromCatalog,
  useQrAudioCatalog,
} from "@/lib/qr-audio-catalog-client";
import {
  buildAudioModelPickerCatalog,
  buildAudioProviderOptions,
  getAudioModelCatalogEntry,
  QR_AUDIO_FEATURE_FILTER_OPTIONS,
} from "@/lib/qr-audio-model-picker-catalog";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";
import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

const QR_VOICE_CLONE_INTERJECTION_HINT =
  "语气词标签：仅当模型选择 speech-2.8-hd 或 speech-2.8-turbo 时，支持在文本中插入语气词标签。支持的语气词：(laughs)（笑声）、(chuckle)（轻笑）、(coughs)（咳嗽）、(clear-throat)（清嗓子）、(groans)（呻吟）、(breath)（正常换气）、(pant)（喘气）、(inhale)（吸气）、(exhale)（呼气）、(gasps)（倒吸气）、(sniffs)（吸鼻子）、(sighs)（叹气）、(snorts)（喷鼻息）、(burps)（打嗝）、(lip-smacking)（咂嘴）、(humming)（哼唱）、(hissing)（嘶嘶声）、(emm)（嗯）、(whistles)（口哨）、(sneezes)（喷嚏）、(crying)（抽泣）、(applause)（鼓掌）";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
};

async function uploadAudio(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await fetchQrPlatform("/api/book-mall/api/platform/v1/quick-replica/assets/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl, kind: "audio" }),
  });
  if (!res.ok) throw new Error("上传失败");
  const data = (await res.json()) as { url: string };
  return data.url;
}

function VoiceReferenceCard({
  url,
  busy,
  uploading,
  onClear,
  onPickFile,
}: {
  url: string;
  busy?: boolean;
  uploading: boolean;
  onClear: () => void;
  onPickFile: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) onPickFile(file);
    },
    [onPickFile],
  );

  if (!url) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 transition ${
          dragOver
            ? "border-[var(--qr-brand)] bg-[rgba(59,130,246,0.08)]"
            : "border-white/15 bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]"
        }`}
      >
        <Upload className="h-9 w-9 text-[var(--qr-text-muted)]" />
        <span className="text-center text-sm text-[var(--qr-text-secondary)]">
          {uploading ? "上传中…" : "上传或拖入参考音频（mp3 / m4a / wav，10s–5min）"}
        </span>
        <input
          ref={inputRef}
          type="file"
          accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
          className="hidden"
          disabled={busy || uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onPickFile(file);
          }}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1030] via-[#121826] to-[#0d1117] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs text-[var(--qr-text-muted)]">参考音色</span>
        <button
          type="button"
          disabled={busy || uploading}
          onClick={onClear}
          className="rounded-lg p-1.5 text-[var(--qr-text-muted)] hover:bg-white/10 disabled:opacity-40"
          aria-label="清除参考音频"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const el = audioRef.current;
            if (!el) return;
            if (playing) {
              el.pause();
              setPlaying(false);
            } else {
              void el.play();
              setPlaying(true);
            }
          }}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white hover:bg-black/55"
        >
          <Play className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <HorizontalOscilloscopeWaveform active={playing} barCount={72} className="h-10 w-full" />
        </div>
      </div>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        className="hidden"
        onEnded={() => setPlaying(false)}
      />
      <button
        type="button"
        disabled={busy || uploading}
        onClick={() => inputRef.current?.click()}
        className="mt-3 w-full text-center text-xs text-[var(--qr-text-muted)] hover:text-[var(--qr-text-secondary)]"
      >
        {uploading ? "上传中…" : "点击更换参考音频"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/wav,audio/x-m4a,.mp3,.m4a,.wav"
        className="hidden"
        disabled={busy || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPickFile(file);
        }}
      />
    </div>
  );
}

/** 音色快速复刻工作区 */
export function QrVoiceCloneForm({ draft, onDraftChange, busy }: Props) {
  const { catalog, loading } = useQrAudioCatalog();
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [langSheetOpen, setLangSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const cloneModels = useMemo(
    () => (catalog ? getQrVoiceCloneModelsFromCatalog(catalog) : []),
    [catalog],
  );
  const modelCatalog = useMemo(
    () => buildAudioModelPickerCatalog(cloneModels, "voice-clone"),
    [cloneModels],
  );
  const catalogEntry = useMemo(
    () => getAudioModelCatalogEntry(modelCatalog, draft.modelKey),
    [modelCatalog, draft.modelKey],
  );

  if (loading || !catalog) {
    return (
      <div className="space-y-4">
        <div className="qr-skeleton h-20 w-full rounded-2xl" />
        <div className="qr-skeleton min-h-[160px] w-full rounded-2xl" />
        <div className="qr-skeleton min-h-[240px] w-full rounded-2xl" />
      </div>
    );
  }

  const refUrl = draft.referenceAudioUrl ?? draft.sourceAudioUrl ?? "";
  const promptLen = draft.prompt.length;
  const languageBoost = draft.languageBoost ?? catalog.defaults.languageBoost ?? "auto";
  const langOptions = catalog.languageBoostOptions ?? ["auto", "Chinese", "English"];
  const emotions = draft.voiceEmotions ?? {
    happy: 0,
    angry: 0,
    sad: 0,
    fearful: 0,
    disgusted: 0,
    calm: 0,
    surprised: 0,
    neutral: 0,
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadAudio(file);
      onDraftChange({
        ...draft,
        referenceAudioUrl: url,
        sourceAudioUrl: url,
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <QrModelPickerTrigger
        entry={catalogEntry}
        busy={busy}
        label="Audio model"
        subtitle={catalogEntry.description}
        onOpen={() => setModelSheetOpen(true)}
      />

      <section className="qr-card p-4">
        <h3 className="mb-3 text-sm font-medium text-[var(--qr-text-primary)]">
          1. Add Voice Reference
        </h3>
        <VoiceReferenceCard
          url={refUrl}
          busy={busy}
          uploading={uploading}
          onClear={() =>
            onDraftChange({ ...draft, referenceAudioUrl: "", sourceAudioUrl: "" })
          }
          onPickFile={(file) => void handleUpload(file)}
        />
      </section>

      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <label
            htmlFor="qr-voice-clone-prompt"
            className="text-sm font-medium text-[var(--qr-text-primary)]"
          >
            2. 复刻的文字
          </label>
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--qr-text-muted)]">
            {promptLen}/{QR_VOICE_CLONE_PROMPT_MAX}
          </span>
        </div>
        <textarea
          id="qr-voice-clone-prompt"
          className="qr-input qr-textarea-resizable min-h-[200px] w-full flex-1"
          value={draft.prompt}
          disabled={busy}
          maxLength={QR_VOICE_CLONE_PROMPT_MAX}
          placeholder="输入希望复刻音色朗读的文本，生成后将返回试听音频…"
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--qr-text-muted)]">
          {QR_VOICE_CLONE_INTERJECTION_HINT}
        </p>
      </section>

      <section className="qr-card p-4">
        <button
          type="button"
          disabled={busy}
          onClick={() => setLangSheetOpen(true)}
          className="flex w-full items-center justify-between text-left"
        >
          <span>
            <span className="block text-xs text-[var(--qr-text-muted)]">language_boost</span>
            <span className="block text-sm font-medium text-[var(--qr-text-primary)]">{languageBoost}</span>
          </span>
          <span className="text-xs text-[var(--qr-text-muted)]">可选 · 默认 auto</span>
        </button>
      </section>

      <QrAudioEmotionControlGrid
        values={emotions}
        disabled={busy}
        onChange={(voiceEmotions) => onDraftChange({ ...draft, voiceEmotions })}
      />

      <section className="qr-card space-y-3 p-4">
        <p className="text-xs font-medium text-[var(--qr-text-muted)]">高级选项</p>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--qr-text-secondary)]">降噪 need_noise_reduction</span>
          <input
            type="checkbox"
            checked={draft.needNoiseReduction ?? false}
            disabled={busy}
            onChange={(e) => onDraftChange({ ...draft, needNoiseReduction: e.target.checked })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--qr-text-secondary)]">音量归一化 need_volume_normalization</span>
          <input
            type="checkbox"
            checked={draft.needVolumeNormalization ?? false}
            disabled={busy}
            onChange={(e) =>
              onDraftChange({ ...draft, needVolumeNormalization: e.target.checked })
            }
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-[var(--qr-text-secondary)]">试听末尾 AIGC 标识 aigc_watermark</span>
          <input
            type="checkbox"
            checked={draft.aigcWatermark ?? false}
            disabled={busy}
            onChange={(e) => onDraftChange({ ...draft, aigcWatermark: e.target.checked })}
          />
        </label>
        <div>
          <label className="mb-1 block text-xs text-[var(--qr-text-muted)]">
            text_validation（可选，≤200 字）
          </label>
          <input
            type="text"
            className="qr-input w-full"
            value={draft.textValidation ?? ""}
            disabled={busy}
            maxLength={200}
            placeholder="参考音频预期文本，用于 ASR 校验"
            onChange={(e) => onDraftChange({ ...draft, textValidation: e.target.value })}
          />
        </div>
      </section>

      <QrModelPicker
        open={modelSheetOpen}
        title="Voice clone model"
        selectedModelKey={draft.modelKey}
        catalog={modelCatalog}
        filterOptions={{
          providerOptions: buildAudioProviderOptions(modelCatalog),
          featureOptions: QR_AUDIO_FEATURE_FILTER_OPTIONS,
        }}
        onSelect={(modelKey) => onDraftChange({ ...draft, modelKey })}
        onClose={() => setModelSheetOpen(false)}
      />

      {langSheetOpen ? (
        <QrAudioOptionSheet
          title="language_boost"
          options={langOptions.map((v) => ({ value: v, label: v }))}
          value={languageBoost}
          onSelect={(languageBoost) => onDraftChange({ ...draft, languageBoost })}
          onClose={() => setLangSheetOpen(false)}
        />
      ) : null}
    </div>
  );
}
