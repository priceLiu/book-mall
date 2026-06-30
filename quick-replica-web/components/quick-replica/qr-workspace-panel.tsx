"use client";

import { useState } from "react";

import { QrMotionSyncForm } from "@/components/quick-replica/qr-motion-sync-workspace";
import {
  getKindDef,
  isHappyHorseR2vModel,
  validateHappyHorseMotionSyncDraft,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";
import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  onGenerate: (draft: QrWorkspaceDraft) => void;
  generating?: boolean;
  onBackToBrowse?: () => void;
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function QrWorkspacePanel({
  draft,
  onDraftChange,
  onGenerate,
  generating = false,
  onBackToBrowse,
}: Props) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kindDef = getKindDef(draft.kind);
  const isMotionSync = draft.kind === "motion-sync" || draft.toolKey === "motion-sync";

  const uploadAsset = async (file: File, kind: "image" | "video" | "audio") => {
    const dataUrl = await readFileAsDataUrl(file);
    const res = await fetchQrPlatform("/api/book-mall/api/platform/v1/quick-replica/assets/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, kind }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? `上传失败（${res.status}）`);
    }
    const data = (await res.json()) as { url: string };
    return data.url;
  };

  const handleGenerate = () => {
    setError(null);
    if (isMotionSync) {
      if (isHappyHorseR2vModel(draft.modelKey)) {
        const validationError = validateHappyHorseMotionSyncDraft({
          prompt: draft.prompt,
          sceneImageUrls: draft.sceneImageUrls,
          targetImageUrl: draft.targetImageUrl,
        });
        if (validationError) {
          setError(validationError);
          return;
        }
      } else if (!draft.targetImageUrl.trim() || !draft.referenceVideoUrl.trim()) {
        setError("请先上传目标图与参考视频");
        return;
      }
    }
    onGenerate(draft);
  };

  const isHappyHorseMotion = isMotionSync && isHappyHorseR2vModel(draft.modelKey);

  const needsTargetImage =
    isMotionSync ||
    draft.kind.includes("edit") ||
    draft.kind.includes("variation") ||
    draft.kind.includes("upscale") ||
    draft.kind === "lip-sync";

  const needsReferenceVideo = isMotionSync && !isHappyHorseMotion;
  const needsReferenceAudio = draft.kind === "lip-sync" || draft.category === "audio";
  const needsSceneImages =
    draft.category === "world" || draft.kind.includes("scene");

  const busy = generating || uploadingImage || uploadingVideo;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header shrink-0">
        <span>{kindDef?.label ?? draft.kind}</span>
        <div className="flex items-center gap-3">
          {onBackToBrowse ? (
          <button
            type="button"
            className="text-xs text-[var(--qr-text-muted)] hover:text-[var(--qr-text-primary)]"
            onClick={onBackToBrowse}
          >
            返回列表
          </button>
          ) : null}
        </div>
      </div>

      <div className="qr-scroll-panel min-h-0 flex-1 p-4">
        {isMotionSync ? (
          <QrMotionSyncForm
            draft={draft}
            onDraftChange={onDraftChange}
            busy={generating}
            uploadingImage={uploadingImage}
            uploadingVideo={uploadingVideo}
            onUploadImage={async (file) => {
              try {
                setUploadingImage(true);
                setError(null);
                const url = await uploadAsset(file, "image");
                onDraftChange({ ...draft, targetImageUrl: url });
              } catch (err) {
                setError(err instanceof Error ? err.message : "上传失败");
              } finally {
                setUploadingImage(false);
              }
            }}
            onUploadVideo={async (file) => {
              try {
                setUploadingVideo(true);
                setError(null);
                const url = await uploadAsset(file, "video");
                onDraftChange({ ...draft, referenceVideoUrl: url });
              } catch (err) {
                setError(err instanceof Error ? err.message : "上传失败");
              } finally {
                setUploadingVideo(false);
              }
            }}
            onUploadReferenceImages={async (files) => {
              try {
                setUploadingImage(true);
                setError(null);
                const slotsLeft = Math.max(0, 9 - draft.sceneImageUrls.length);
                const batch = files.slice(0, slotsLeft);
                const urls: string[] = [];
                for (const file of batch) {
                  urls.push(await uploadAsset(file, "image"));
                }
                onDraftChange({
                  ...draft,
                  sceneImageUrls: [...draft.sceneImageUrls, ...urls].slice(0, 9),
                });
              } catch (err) {
                setError(err instanceof Error ? err.message : "上传失败");
              } finally {
                setUploadingImage(false);
              }
            }}
            onRemoveReferenceImage={(index) => {
              onDraftChange({
                ...draft,
                sceneImageUrls: draft.sceneImageUrls.filter((_, i) => i !== index),
              });
            }}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--qr-text-muted)]">模型</label>
              <input className="qr-input" value={draft.modelKey}
                disabled={generating}
                onChange={(e) => onDraftChange({ ...draft, modelKey: e.target.value })}
              />
            </div>

            {needsTargetImage ? (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">目标图</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-xs text-zinc-400"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingImage(true);
                      const url = await uploadAsset(file, "image");
                      onDraftChange({ ...draft, targetImageUrl: url });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                />
                {draft.targetImageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={draft.targetImageUrl}
                    alt="target"
                    className="mt-2 max-h-40 rounded-lg border border-white/10"
                  />
                ) : null}
              </div>
            ) : null}

            {needsReferenceVideo ? (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">参考视频</label>
                <input
                  type="file"
                  accept="video/*"
                  className="block w-full text-xs text-zinc-400"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingVideo(true);
                      const url = await uploadAsset(file, "video");
                      onDraftChange({ ...draft, referenceVideoUrl: url });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setUploadingVideo(false);
                    }
                  }}
                />
              </div>
            ) : null}

            {needsReferenceAudio ? (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">参考音频</label>
                <input
                  type="file"
                  accept="audio/*"
                  className="block w-full text-xs text-zinc-400"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingVideo(true);
                      const url = await uploadAsset(file, "audio");
                      onDraftChange({ ...draft, referenceAudioUrl: url });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setUploadingVideo(false);
                    }
                  }}
                />
              </div>
            ) : null}

            {needsSceneImages ? (
              <div>
                <label className="mb-1 block text-xs text-zinc-400">场景图</label>
                <input
                  type="file"
                  accept="image/*"
                  className="block w-full text-xs text-zinc-400"
                  disabled={busy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      setUploadingImage(true);
                      const url = await uploadAsset(file, "image");
                      onDraftChange({
                        ...draft,
                        sceneImageUrls: [...draft.sceneImageUrls, url],
                      });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setUploadingImage(false);
                    }
                  }}
                />
                {draft.sceneImageUrls.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {draft.sceneImageUrls.map((url) => (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        key={url}
                        src={url}
                        alt="scene"
                        className="h-16 w-16 rounded border border-white/10 object-cover"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-xs text-[var(--qr-text-muted)]">提示词</label>
              <textarea
                className="qr-input min-h-[100px]"
                value={draft.prompt}
                disabled={generating}
                onChange={(e) => onDraftChange({ ...draft, prompt: e.target.value })}
              />
            </div>
          </div>
        )}

        {error ? (
          <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </div>

      <div className="shrink-0 p-4" style={{ borderTop: "1px solid var(--qr-border)" }}>
        <button
          type="button"
          disabled={generating}
          onClick={handleGenerate}
          className="w-full qr-btn-primary py-3 disabled:opacity-50"
        >
          {generating ? "产生中…" : "产生"}
        </button>
      </div>
    </div>
  );
}

/** @deprecated 兼容旧引用 */
export type QrGenerateJobResult = {
  status: string;
  outputUrl?: string;
  error?: string;
  template?: import("@/lib/qr-template-types").QrTemplate;
};
