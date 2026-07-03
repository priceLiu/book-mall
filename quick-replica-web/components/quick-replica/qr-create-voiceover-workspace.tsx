"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";

import {
  QrAudioModelPickerButton,
  QrAudioOptionSheet,
  QrAudioVoiceControlHeading,
  QrAudioVoiceControlSlider,
  QrAudioVoicePickerButton,
} from "@/components/quick-replica/qr-audio-form-parts";
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
  voicePickerActive?: boolean;
  onOpenVoiceGallery?: () => void;
};

/** 旁白 / 声音工作区（Audio model · Prompt · Voice · Voice control） */
export function QrCreateVoiceoverForm({
  draft,
  onDraftChange,
  busy,
  voicePickerActive,
  onOpenVoiceGallery,
}: Props) {
  const { catalog, loading } = useQrAudioCatalog();
  const [modelSheetOpen, setModelSheetOpen] = useState(false);

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
  const volume = draft.voiceVolume ?? catalog.defaults.voiceVolume;
  const pitch = draft.voicePitch ?? catalog.defaults.voicePitch;
  const tone = draft.voiceTone ?? catalog.defaults.voiceTone;
  const intensity = draft.voiceIntensity ?? catalog.defaults.voiceIntensity;
  const timbre = draft.voiceTimbre ?? catalog.defaults.voiceTimbre;
  const activeTemplateId = resolveActivePromptTemplateId(
    catalog,
    "create-voiceover",
    draft.prompt,
    draft.audioStyleTag,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <QrAudioModelPickerButton
        catalog={catalog}
        modelKey={draft.modelKey}
        busy={busy}
        onOpen={() => setModelSheetOpen(true)}
      />

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
          <QrAudioPromptTemplatePills
            catalog={catalog}
            kind="create-voiceover"
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
          <span className="shrink-0 text-[11px] tabular-nums text-[var(--qr-text-muted)]">
            {promptLength}/{PROMPT_MAX.toLocaleString()}
          </span>
        </div>
      </section>

      <QrAudioVoicePickerButton
        catalog={catalog}
        voiceId={draft.voiceId}
        busy={busy}
        pickerActive={voicePickerActive}
        onOpenGallery={onOpenVoiceGallery ?? (() => undefined)}
      />

      <section className="space-y-3">
        <QrAudioVoiceControlHeading />
        <QrAudioVoiceControlSlider
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
        <QrAudioVoiceControlSlider
          label="Volume"
          value={volume}
          min={0}
          max={2}
          step={0.01}
          leftLabel="Quiet"
          rightLabel="Loud"
          disabled={busy}
          onChange={(voiceVolume) => onDraftChange({ ...draft, voiceVolume })}
        />
        <QrAudioVoiceControlSlider
          label="Pitch"
          value={pitch}
          min={-12}
          max={12}
          step={0.1}
          leftLabel="Lower"
          rightLabel="Higher"
          disabled={busy}
          onChange={(voicePitch) => onDraftChange({ ...draft, voicePitch })}
        />
        <QrAudioVoiceControlSlider
          label="Tone"
          value={tone}
          min={0}
          max={1}
          step={0.01}
          leftLabel="Neutral"
          rightLabel="Expressive"
          disabled={busy}
          onChange={(voiceTone) => onDraftChange({ ...draft, voiceTone })}
        />
        <QrAudioVoiceControlSlider
          label="Intensity"
          value={intensity}
          min={0}
          max={1}
          step={0.01}
          leftLabel="Soft"
          rightLabel="Strong"
          disabled={busy}
          onChange={(voiceIntensity) => onDraftChange({ ...draft, voiceIntensity })}
        />
        <QrAudioVoiceControlSlider
          label="Timbre"
          value={timbre}
          min={0}
          max={1}
          step={0.01}
          leftLabel="Light"
          rightLabel="Rich"
          disabled={busy}
          onChange={(voiceTimbre) => onDraftChange({ ...draft, voiceTimbre })}
        />
      </section>

      {modelSheetOpen ? (
        <QrAudioOptionSheet
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
    </div>
  );
}
