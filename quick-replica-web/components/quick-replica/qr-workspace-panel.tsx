"use client";

import { useEffect, useState } from "react";

import { QrMotionSyncForm } from "@/components/quick-replica/qr-motion-sync-workspace";
import { persistWorkspaceDraft } from "@/lib/qr-template-save";
import {
  getKindDef,
  type QrTemplate,
  type QrWorkspaceDraft,
} from "@/lib/qr-template-types";

export type QrGenerateJobResult = {
  status: string;
  outputUrl?: string;
  error?: string;
  template?: QrTemplate;
};

type Props = {
  draft: QrWorkspaceDraft;
  onDraftChange: (draft: QrWorkspaceDraft) => void;
  onGenerateComplete: (result: QrGenerateJobResult) => void;
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
  onGenerateComplete,
  onBackToBrowse,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const kindDef = getKindDef(draft.kind);
  const isMotionSync = draft.kind === "motion-sync" || draft.toolKey === "motion-sync";

  useEffect(() => {
    if (!draft.savedTemplateId) return;
    setSaveHint("保存中…");
    const timer = window.setTimeout(() => {
      void persistWorkspaceDraft(draft).then((result) => {
        if (result.ok) {
          setSaveHint("已自动保存");
        } else {
          setSaveHint(null);
        }
      });
    }, 900);
    return () => window.clearTimeout(timer);
  }, [draft]);

  const uploadAsset = async (file: File, kind: "image" | "video" | "audio") => {
    const dataUrl = await readFileAsDataUrl(file);
    const res = await fetch("/api/book-mall/api/platform/v1/quick-replica/assets/upload", {
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

  const handleGenerate = async () => {
    setError(null);
    if (isMotionSync && (!draft.targetImageUrl.trim() || !draft.referenceVideoUrl.trim())) {
      setError("请先上传目标图与参考视频");
      return;
    }
    setBusy(true);
    try {
      const createRes = await fetch(
        "/api/book-mall/api/platform/v1/quick-replica/jobs/generate",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      if (!createRes.ok) {
        const body = (await createRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `创建任务失败（${createRes.status}）`);
      }
      const created = (await createRes.json()) as { logId: string };

      for (let i = 0; i < 120; i += 1) {
        await new Promise((r) => setTimeout(r, 3000));
        const pollRes = await fetch(
          `/api/book-mall/api/platform/v1/quick-replica/jobs/${encodeURIComponent(created.logId)}`,
        );
        if (!pollRes.ok) continue;
        const job = (await pollRes.json()) as QrGenerateJobResult;
        if (job.status === "SUCCEEDED" && job.template) {
          onGenerateComplete(job);
          return;
        }
        if (job.status === "FAILED") {
          onGenerateComplete(job);
          return;
        }
      }
      onGenerateComplete({ status: "FAILED", error: "轮询超时，请稍后在 Gateway 日志查看" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  const needsTargetImage =
    isMotionSync ||
    draft.kind.includes("edit") ||
    draft.kind.includes("variation") ||
    draft.kind.includes("upscale") ||
    draft.kind === "lip-sync";

  const needsReferenceVideo = isMotionSync;
  const needsReferenceAudio = draft.kind === "lip-sync" || draft.category === "audio";
  const needsSceneImages =
    draft.category === "world" || draft.kind.includes("scene");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="qr-panel-header shrink-0">
        <span>{kindDef?.label ?? draft.kind}</span>
        <div className="flex items-center gap-3">
          {saveHint ? (
            <span className="text-[10px] text-[var(--qr-text-muted)]">{saveHint}</span>
          ) : null}
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
            busy={busy}
            onUploadImage={async (file) => {
              try {
                setBusy(true);
                const url = await uploadAsset(file, "image");
                onDraftChange({ ...draft, targetImageUrl: url });
              } catch (err) {
                setError(err instanceof Error ? err.message : "上传失败");
              } finally {
                setBusy(false);
              }
            }}
            onUploadVideo={async (file) => {
              try {
                setBusy(true);
                const url = await uploadAsset(file, "video");
                onDraftChange({ ...draft, referenceVideoUrl: url });
              } catch (err) {
                setError(err instanceof Error ? err.message : "上传失败");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[var(--qr-text-muted)]">模型</label>
              <input className="qr-input" value={draft.modelKey}
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
                      setBusy(true);
                      const url = await uploadAsset(file, "image");
                      onDraftChange({ ...draft, targetImageUrl: url });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setBusy(false);
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
                      setBusy(true);
                      const url = await uploadAsset(file, "video");
                      onDraftChange({ ...draft, referenceVideoUrl: url });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setBusy(false);
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
                      setBusy(true);
                      const url = await uploadAsset(file, "audio");
                      onDraftChange({ ...draft, referenceAudioUrl: url });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setBusy(false);
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
                      setBusy(true);
                      const url = await uploadAsset(file, "image");
                      onDraftChange({
                        ...draft,
                        sceneImageUrls: [...draft.sceneImageUrls, url],
                      });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "上传失败");
                    } finally {
                      setBusy(false);
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
          disabled={busy}
          onClick={() => void handleGenerate()}
          className="w-full qr-btn-primary py-3 disabled:opacity-50"
        >
          {busy ? "产生中…" : "产生"}
        </button>
      </div>
    </div>
  );
}
