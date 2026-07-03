"use client";

import { Music2 } from "lucide-react";

import {
  getQrAudioModelFromCatalog,
  useQrAudioCatalog,
} from "@/lib/qr-audio-catalog-client";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  busy?: boolean;
};

const MUSIC_MODES = [
  { id: "generate" as const, label: "音乐生成" },
  { id: "cover" as const, label: "翻唱前处理" },
  { id: "lyrics" as const, label: "歌词生成" },
];

export function QrCreateMusicForm({ draft, onDraftChange, busy }: Props) {
  const { catalog, loading } = useQrAudioCatalog();
  const mode = draft.musicMode ?? "generate";

  if (loading || !catalog) {
    return <div className="qr-skeleton h-64 w-full rounded-2xl" />;
  }

  const musicModel =
    catalog.models.find((m) => m.modelKey.includes("music")) ?? catalog.models[0]!;
  const model = getQrAudioModelFromCatalog(catalog, draft.modelKey || musicModel.modelKey);

  return (
    <div className="space-y-4">
      <div className="qr-card flex items-center gap-3 p-4">
        <Music2 className="h-5 w-5 text-[var(--qr-brand)]" />
        <div>
          <div className="text-xs text-[var(--qr-text-muted)]">Music model</div>
          <div className="text-sm font-medium">{model.label}</div>
          <div className="text-xs text-[var(--qr-text-secondary)]">{model.subtitle}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {MUSIC_MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            disabled={busy}
            onClick={() =>
              onDraftChange({
                ...draft,
                musicMode: m.id,
                modelKey: musicModel.modelKey,
              })
            }
            className={`rounded-full border px-3 py-1.5 text-xs ${
              mode === m.id
                ? "border-[var(--qr-brand)] bg-[rgba(59,130,246,0.12)]"
                : "border-white/10 text-[var(--qr-text-muted)]"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <section className="qr-card p-4">
        <label htmlFor="qr-music-prompt" className="mb-2 block text-sm font-medium">
          {mode === "lyrics" ? "歌词主题 / Prompt" : "音乐描述"}
        </label>
        <textarea
          id="qr-music-prompt"
          className="qr-input qr-textarea-resizable min-h-[200px] w-full"
          value={draft.prompt}
          disabled={busy}
          placeholder={
            mode === "lyrics"
              ? "描述想要的歌词风格与主题…"
              : "描述音乐风格、情绪、乐器…"
          }
          onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
        />
      </section>

      {mode === "generate" ? (
        <section className="qr-card p-4">
          <label htmlFor="qr-music-duration" className="mb-2 block text-sm font-medium">
            时长（秒）
          </label>
          <input
            id="qr-music-duration"
            type="number"
            min={5}
            max={240}
            className="qr-input w-full"
            value={draft.duration ?? 30}
            disabled={busy}
            onChange={(e) =>
              onDraftChange({ ...draft, duration: Number.parseInt(e.target.value, 10) || 30 })
            }
          />
        </section>
      ) : null}
    </div>
  );
}
