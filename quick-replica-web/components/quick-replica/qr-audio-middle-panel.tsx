"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { QrCreateMusicForm } from "@/components/quick-replica/qr-create-music-workspace";
import { QrCreateVoiceoverForm } from "@/components/quick-replica/qr-create-voiceover-workspace";
import { QrVoiceChangerForm } from "@/components/quick-replica/qr-voice-changer-workspace";
import { QrVoiceCloneForm } from "@/components/quick-replica/qr-voice-clone-workspace";
import {
  QR_KINDS_BY_CATEGORY,
  defaultWorkspaceDraft,
  getKindDef,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  generating?: boolean;
  onGenerate: (draft: QrWorkspaceDraft) => void;
  onBackToBrowse?: () => void;
  voicePickerActive?: boolean;
  onOpenVoiceGallery: () => void;
};

export function QrAudioMiddlePanel({
  draft,
  onDraftChange,
  generating = false,
  onGenerate,
  onBackToBrowse,
  voicePickerActive,
  onOpenVoiceGallery,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const kindDef = getKindDef(draft.kind);
  const audioKinds = QR_KINDS_BY_CATEGORY.audio;

  const switchKind = (kind: string) => {
    onDraftChange(
      defaultWorkspaceDraft({
        category: "audio",
        kind,
        toolKey: getKindDef(kind)?.toolKey,
      }),
    );
  };

  const handleGenerate = () => {
    setError(null);
    if (draft.kind === "voice-clone") {
      const ref = draft.referenceAudioUrl ?? draft.sourceAudioUrl;
      if (!ref?.trim()) {
        setError("请上传参考音频");
        return;
      }
      if (!draft.prompt.trim()) {
        setError("请填写复刻的文字");
        return;
      }
      onGenerate(draft);
      return;
    }
    if (!draft.prompt.trim() && draft.kind !== "voice-changer") {
      setError("请填写内容");
      return;
    }
    if (draft.kind === "voice-changer") {
      const src = draft.sourceAudioUrl ?? draft.referenceAudioUrl;
      if (!src?.trim()) {
        setError("请上传源音频");
        return;
      }
      if (!draft.voiceId?.trim()) {
        setError("请选择目标音色");
        return;
      }
    }
    onGenerate(draft);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--qr-text-primary)]">
              {kindDef?.label ?? "声音"}
            </h2>
            {kindDef?.labelEn ? (
              <p className="text-[11px] text-[var(--qr-text-muted)]">{kindDef.labelEn}</p>
            ) : null}
          </div>
          {onBackToBrowse ? (
            <button type="button" className="qr-btn-secondary text-xs" onClick={onBackToBrowse}>
              返回
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {audioKinds.map((k) => (
            <button
              key={k.id}
              type="button"
              disabled={generating}
              onClick={() => switchKind(k.id)}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition ${
                draft.kind === k.id
                  ? "bg-[rgba(59,130,246,0.22)] text-[var(--qr-text-primary)]"
                  : "bg-white/5 text-[var(--qr-text-muted)] hover:bg-white/10"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {draft.kind === "voice-changer" ? (
          <QrVoiceChangerForm
            draft={draft}
            onDraftChange={onDraftChange}
            busy={generating}
            voicePickerActive={voicePickerActive}
            onOpenVoiceGallery={onOpenVoiceGallery}
          />
        ) : draft.kind === "voice-clone" ? (
          <QrVoiceCloneForm draft={draft} onDraftChange={onDraftChange} busy={generating} />
        ) : draft.kind === "create-music" ? (
          <QrCreateMusicForm draft={draft} onDraftChange={onDraftChange} busy={generating} />
        ) : (
          <QrCreateVoiceoverForm
            draft={draft}
            onDraftChange={onDraftChange}
            busy={generating}
            voicePickerActive={voicePickerActive}
            onOpenVoiceGallery={onOpenVoiceGallery}
          />
        )}
      </div>

      <div
        className="shrink-0 border-t p-4"
        style={{ borderColor: "var(--qr-border)", background: "var(--qr-bg-surface)" }}
      >
        {error ? <p className="mb-2 text-sm text-red-400">{error}</p> : null}
        <button
          type="button"
          className="qr-btn-primary flex w-full items-center justify-center gap-2"
          disabled={generating}
          onClick={handleGenerate}
        >
          <Sparkles className="h-4 w-4" />
          {generating ? "生成中…" : "产生"}
        </button>
      </div>
    </div>
  );
}
