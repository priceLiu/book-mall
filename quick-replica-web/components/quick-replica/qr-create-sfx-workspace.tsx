"use client";

import { RefreshCw, Trash2 } from "lucide-react";

import {
  QrAudioVoiceControlSlider,
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
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[var(--qr-text-primary)]">{label}</span>
        {subtitle ? (
          <span className="block text-xs text-[var(--qr-text-muted)]">{subtitle}</span>
        ) : null}
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

/** 创建音效 · ElevenLabs（UI 不暴露模型，Gateway 固定 eleven_text_to_sound_v2） */
export function QrCreateSfxForm({ draft, onDraftChange, busy }: Props) {
  const { catalog, loading } = useQrAudioCatalog();

  if (loading || !catalog) {
    return (
      <div className="space-y-4">
        <div className="qr-skeleton min-h-[280px] w-full rounded-2xl" />
      </div>
    );
  }

  const loop = draft.sfxLoop ?? catalog.defaults.sfxLoop ?? false;
  const durationAuto = draft.sfxDurationAuto ?? catalog.defaults.sfxDurationAuto ?? true;
  const durationSeconds = draft.sfxDurationSeconds ?? catalog.defaults.sfxDurationSeconds ?? 5;
  const promptInfluence = draft.sfxPromptInfluence ?? catalog.defaults.sfxPromptInfluence ?? 0.3;
  const activeTemplateId = resolveActivePromptTemplateId(
    catalog,
    "create-sfx",
    draft.prompt,
    draft.audioStyleTag,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <section className="qr-card flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-center justify-between">
          <label htmlFor="qr-sfx-prompt" className="text-sm font-medium text-[var(--qr-text-primary)]">
            Describe the sound
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
          id="qr-sfx-prompt"
          className="qr-input qr-textarea-resizable min-h-[220px] w-full flex-1"
          value={draft.prompt}
          maxLength={PROMPT_MAX}
          disabled={busy}
          placeholder='例如 "Deep cinematic boom impact with sub-bass rumble"'
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
        <div className="mt-3 flex items-center justify-between gap-2">
          <QrAudioPromptTemplatePills
            catalog={catalog}
            kind="create-sfx"
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
              const tags = catalog.sfxStyleTags ?? [];
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
        label="Loop"
        subtitle={loop ? "On" : "Off"}
        checked={loop}
        disabled={busy}
        onChange={(sfxLoop) => onDraftChange({ ...draft, sfxLoop })}
      />

      <section className="qr-card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--qr-text-primary)]">Sound Control</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-[var(--qr-text-muted)]">
            Optional
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-[var(--qr-text-secondary)]">Duration</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--qr-text-muted)]">{durationAuto ? "Auto" : "Manual"}</span>
            <button
              type="button"
              role="switch"
              aria-checked={durationAuto}
              disabled={busy}
              onClick={() => onDraftChange({ ...draft, sfxDurationAuto: !durationAuto })}
              className={`relative h-6 w-10 rounded-full border transition disabled:opacity-40 ${
                durationAuto
                  ? "border-[rgba(234,94,193,0.6)] bg-[rgba(234,94,193,0.35)]"
                  : "border-white/15 bg-white/10"
              }`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                  durationAuto ? "left-[1.05rem]" : "left-0.5"
                }`}
              />
            </button>
          </div>
        </div>

        {!durationAuto ? (
          <QrAudioVoiceControlSlider
            label="Duration (seconds)"
            value={durationSeconds}
            min={0.5}
            max={30}
            step={0.5}
            leftLabel="0.5s"
            rightLabel="30s"
            disabled={busy}
            onChange={(sfxDurationSeconds) => onDraftChange({ ...draft, sfxDurationSeconds })}
          />
        ) : null}

        <QrAudioVoiceControlSlider
          label="Prompt Influence"
          value={promptInfluence}
          min={0}
          max={1}
          step={0.01}
          leftLabel="Loose"
          rightLabel="Strict"
          disabled={busy}
          onChange={(sfxPromptInfluence) => onDraftChange({ ...draft, sfxPromptInfluence })}
        />
      </section>
    </div>
  );
}
