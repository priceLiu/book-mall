"use client";

import { useRef, useState } from "react";
import { Lock, Mic, Upload } from "lucide-react";

import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { useDialogs } from "@/components/dialogs/dialog-provider";
import {
  saveStoryProCharacterAudioAsset,
  setStoryProCharacterAudioAssetLocked,
  uploadCanvasFile,
  type StoryProCharacterAudioAssetRecord,
} from "@/lib/canvas-api";
import {
  STORY_ROW_SECTION_CLASS,
  STORY_ROW_SUBLABEL_CLASS,
} from "@/lib/canvas/story-column-sync";
import {
  StoryErrorLine,
  StoryHintLine,
} from "@/components/canvas/story-status-line";
import { normalizeStoryProCharacterKey } from "@/lib/canvas/story-pro-character-key";
import { notifyStoryProAudioAssetsChanged } from "@/lib/canvas/use-story-pro-audio-assets";

const AUDIO_ACCEPT = "audio/mpeg,audio/wav,audio/mp4,audio/aac,audio/ogg,audio/webm,.mp3,.wav,.m4a,.aac,.ogg,.webm";

export function StoryProCharacterAudioSlot({
  rowKey,
  rowName,
  projectId,
  audioAsset,
}: {
  rowKey: string;
  rowName: string;
  projectId: string | null | undefined;
  audioAsset: StoryProCharacterAudioAssetRecord | undefined;
}) {
  const base = useBookMallBaseUrl();
  const { confirm } = useDialogs();
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [busy, setBusy] = useState(false);
  const [statusHint, setStatusHint] = useState<{
    text: string;
    kind: "error" | "info";
  } | null>(null);

  const locked = audioAsset?.locked === true;
  const sampleUrl = audioAsset?.sampleOssUrl?.trim() || null;
  const canUpload = !locked && !busy && Boolean(base?.trim());

  const uploadSample = async (file: File) => {
    if (!base?.trim() || locked) return;
    setBusy(true);
    setStatusHint(null);
    try {
      const ossUrl = await uploadCanvasFile(base, file);
      await saveStoryProCharacterAudioAsset(base, {
        characterKey: normalizeStoryProCharacterKey(rowKey),
        displayName: rowName,
        projectId: projectId ?? null,
        sampleOssUrl: ossUrl,
        voiceLabel: audioAsset?.voiceLabel ?? `${rowName} · 音色样本`,
      });
      notifyStoryProAudioAssetsChanged();
      setStatusHint({ text: "音色样本已入库", kind: "info" });
    } catch (e) {
      setStatusHint({
        text: e instanceof Error ? e.message : String(e),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleLock = async () => {
    if (!base?.trim() || !audioAsset) return;
    const next = !audioAsset.locked;
    const verb = next ? "锁定" : "解锁";
    if (
      !(await confirm({
        title: `${verb}角色音频`,
        message: `${verb}角色音频「${rowName}」？`,
        confirmLabel: verb,
        cancelLabel: "取消",
      }))
    ) {
      return;
    }
    setBusy(true);
    setStatusHint(null);
    try {
      await setStoryProCharacterAudioAssetLocked(base, audioAsset.id, next);
      notifyStoryProAudioAssetsChanged();
      setStatusHint({ text: next ? "已锁定音色样本" : "已解锁，可替换样本", kind: "info" });
    } catch (e) {
      setStatusHint({
        text: e instanceof Error ? e.message : String(e),
        kind: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`nodrag mt-1.5 ${STORY_ROW_SECTION_CLASS}`}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <p className={`flex items-center gap-1 ${STORY_ROW_SUBLABEL_CLASS}`}>
          <Mic className="size-2.5 shrink-0 text-emerald-300/80" />
          角色音频 · 音色样本
        </p>
        <div className="flex items-center gap-0.5">
          {audioAsset ? (
            <button
              type="button"
              title={locked ? "已锁定" : "锁定样本"}
              className={`nodrag rounded p-0.5 ${
                locked ? "text-emerald-200/80" : "text-white/40 hover:text-white/65"
              }`}
              onClick={() => void toggleLock()}
              disabled={busy}
            >
              <Lock className="size-3" />
            </button>
          ) : null}
          {!locked ? (
            <button
              type="button"
              title="上传音色样本"
              className="nodrag rounded p-0.5 text-white/45 hover:bg-white/5 hover:text-white/75"
              onClick={() => fileRef.current?.click()}
              disabled={!canUpload}
            >
              <Upload className="size-3" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2 rounded border border-white/10 bg-black/30 px-2 py-1.5">
        {sampleUrl ? (
          <>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio
              ref={audioRef}
              src={sampleUrl}
              controls
              preload="metadata"
              className="nodrag h-7 max-w-full flex-1 [&::-webkit-media-controls-panel]:bg-transparent"
            />
          </>
        ) : (
          <span className="flex-1 text-[9px] text-white/30">暂无样本 · 上传 mp3 / wav 等</span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={AUDIO_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void uploadSample(file);
        }}
      />
      {statusHint?.kind === "error" ? (
        <StoryErrorLine message={statusHint.text} className="mt-1" />
      ) : statusHint ? (
        <StoryHintLine className="mt-1">{statusHint.text}</StoryHintLine>
      ) : null}
    </div>
  );
}
