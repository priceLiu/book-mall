"use client";

import { useMemo, useState } from "react";
import { Trash2, Upload } from "lucide-react";

import {
  QrAudioModelPickerButton,
  QrAudioVoiceControlHeading,
  QrAudioVoiceControlSlider,
  QrAudioVoicePickerButton,
} from "@/components/quick-replica/qr-audio-form-parts";
import { QrModelPicker } from "@/components/quick-replica/qr-model-picker";
import { useQrAudioCatalog, isElevenLabsStsModelKey } from "@/lib/qr-audio-catalog-client";
import {
  buildAudioModelPickerCatalog,
  buildAudioProviderOptions,
  QR_AUDIO_FEATURE_FILTER_OPTIONS,
} from "@/lib/qr-audio-model-picker-catalog";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";
import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
  voicePickerActive?: boolean;
  onOpenVoiceGallery?: () => void;
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

/** 变声器 · ElevenLabs STS */
export function QrVoiceChangerForm({
  draft,
  onDraftChange,
  busy,
  voicePickerActive,
  onOpenVoiceGallery,
}: Props) {
  const { catalog, loading } = useQrAudioCatalog();
  const [modelSheetOpen, setModelSheetOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const vcModels = useMemo(() => {
    if (!catalog) return [];
    return catalog.voiceChangerModels?.length
      ? catalog.voiceChangerModels
      : catalog.models.filter((m) => m.provider === "elevenlabs");
  }, [catalog]);
  const modelCatalog = useMemo(
    () => buildAudioModelPickerCatalog(vcModels, "voice-changer"),
    [vcModels],
  );

  if (loading || !catalog) {
    return (
      <div className="space-y-4">
        <div className="qr-skeleton h-20 w-full rounded-2xl" />
        <div className="qr-skeleton min-h-[280px] w-full rounded-2xl" />
        <div className="qr-skeleton h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const stability = draft.voiceStability ?? catalog.defaults.voiceStability;
  const similarity = draft.voiceSimilarityBoost ?? catalog.defaults.voiceSimilarityBoost;
  const exaggeration = draft.voiceStyleExaggeration ?? catalog.defaults.voiceStyleExaggeration;
  const sourceUrl = draft.sourceAudioUrl ?? draft.referenceAudioUrl ?? "";
  const showElevenControls = isElevenLabsStsModelKey(draft.modelKey);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <QrAudioModelPickerButton
        catalog={{ ...catalog, models: vcModels }}
        modelKey={draft.modelKey}
        busy={busy}
        kind="voice-changer"
        onOpen={() => setModelSheetOpen(true)}
      />

      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--qr-text-primary)]">Source audio</h3>
          {sourceUrl ? (
            <button
              type="button"
              disabled={busy || uploading}
              onClick={() =>
                onDraftChange({
                  ...draft,
                  sourceAudioUrl: "",
                  referenceAudioUrl: "",
                })
              }
              className="rounded-lg p-1.5 text-[var(--qr-text-muted)] hover:bg-white/10 disabled:opacity-40"
              aria-label="清除源音频"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <label className="flex min-h-[280px] flex-1 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-6 transition hover:border-white/25 hover:bg-white/[0.04]">
          <Upload className="h-9 w-9 text-[var(--qr-text-muted)]" />
          <span className="text-center text-sm text-[var(--qr-text-secondary)]">
            {uploading
              ? "上传中…"
              : sourceUrl
                ? "已上传，点击更换源音频"
                : "上传音频或视频（提取音轨）"}
          </span>
          {sourceUrl ? (
            <audio
              controls
              src={sourceUrl}
              className="mt-2 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            />
          ) : null}
          <input
            type="file"
            accept="audio/*,video/*"
            className="hidden"
            disabled={busy || uploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const url = await uploadAudio(file);
                onDraftChange({
                  ...draft,
                  sourceAudioUrl: url,
                  referenceAudioUrl: url,
                });
              } finally {
                setUploading(false);
              }
            }}
          />
        </label>
      </section>

      <QrAudioVoicePickerButton
        catalog={catalog}
        voiceId={draft.voiceId}
        busy={busy}
        pickerActive={voicePickerActive}
        onOpenGallery={onOpenVoiceGallery ?? (() => undefined)}
      />

      {showElevenControls ? (
        <section className="qr-card space-y-3 p-4">
          <QrAudioVoiceControlHeading />
          <QrAudioVoiceControlSlider
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
          <QrAudioVoiceControlSlider
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
          <QrAudioVoiceControlSlider
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
      ) : null}

      <QrModelPicker
        open={modelSheetOpen}
        title="Audio model"
        selectedModelKey={draft.modelKey}
        catalog={modelCatalog}
        filterOptions={{
          providerOptions: buildAudioProviderOptions(modelCatalog),
          featureOptions: QR_AUDIO_FEATURE_FILTER_OPTIONS,
        }}
        onSelect={(modelKey) =>
          onDraftChange({
            ...draft,
            modelKey,
            voiceId: isElevenLabsStsModelKey(modelKey)
              ? catalog.defaults.elevenVoiceId ?? draft.voiceId
              : draft.voiceId,
          })
        }
        onClose={() => setModelSheetOpen(false)}
      />
    </div>
  );
}
