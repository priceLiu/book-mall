"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import {
  QrAudioGenerateGenerating,
  QrAudioGenerateSuccess,
} from "@/components/quick-replica/qr-audio-generate-preview";
import { QrModal } from "@/components/quick-replica/qr-modal";
import type { QrGenerateJobResult } from "@/components/quick-replica/qr-workspace-panel";
import { saveQrGenerateJobToMyWorks } from "@/lib/run-qr-generate-job";
import {
  formatQrPlatformError,
  isQrAuthError,
  openQrSessionReconnect,
} from "@/lib/qr-platform-fetch";
import type { QrWorkspaceDraft } from "@/lib/qr-template-types";
import { isQrTextToAudioKind } from "@/lib/qr-template-types";

export type QrGenerateModalPhase = "generating" | "success" | "failed";

type Props = {
  open: boolean;
  phase: QrGenerateModalPhase;
  result: QrGenerateJobResult | null;
  logId?: string | null;
  previewImageUrl?: string;
  generateDraft?: QrWorkspaceDraft | null;
  onClose: () => void;
  onSaved: (template: NonNullable<QrGenerateJobResult["template"]>) => void;
};

function isAudioOutput(
  outputUrl: string | undefined,
  result: QrGenerateJobResult | null,
  draft: QrWorkspaceDraft | null | undefined,
): boolean {
  if (draft && isQrTextToAudioKind(draft)) return true;
  if (result?.template?.output?.mediaType === "audio") return true;
  if (outputUrl && /\.(mp3|wav|m4a|aac|ogg)(\?|$)/i.test(outputUrl)) return true;
  return false;
}

export function QrGeneratePreviewModal({
  open,
  phase,
  result,
  logId,
  previewImageUrl,
  generateDraft,
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAuthExpired, setSaveAuthExpired] = useState(false);

  const outputUrl = result?.outputUrl ?? result?.template?.output?.url;
  const isVideo =
    !isAudioOutput(outputUrl, result, generateDraft) &&
    (result?.template?.output?.mediaType === "video" ||
      Boolean(outputUrl?.includes(".mp4") || outputUrl?.includes(".webm")));
  const isAudio = isAudioOutput(outputUrl, result, generateDraft);
  const generating = phase === "generating";
  const failed = phase === "failed";
  const succeeded = phase === "success" && Boolean(outputUrl);

  const title = generating ? "产生中" : failed ? "产生失败" : "产生完成";

  const handleSave = async () => {
    if (!logId) return;
    setSaving(true);
    setSaveError(null);
    setSaveAuthExpired(false);
    const saved = await saveQrGenerateJobToMyWorks(logId);
    setSaving(false);
    if (saved.error || !saved.template) {
      const msg = formatQrPlatformError(saved.error);
      setSaveError(msg);
      setSaveAuthExpired(isQrAuthError(saved.error));
      return;
    }
    onSaved(saved.template);
    onClose();
  };

  const audioGenerating = generating && isAudio;

  return (
    <QrModal
      open={open}
      onClose={generating ? () => {} : onClose}
      title={audioGenerating ? undefined : title}
      variant={audioGenerating ? "audio-track" : isAudio ? "audio" : "square"}
      hideHeader={audioGenerating}
    >
      <div
        className={
          audioGenerating
            ? "flex min-h-0 flex-1 flex-col"
            : "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
        }
      >
        {audioGenerating && generateDraft ? (
          <QrAudioGenerateGenerating draft={generateDraft} />
        ) : null}

        {generating && !isAudio ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-6">
            <div className="relative aspect-[9/16] w-full max-w-[280px] overflow-hidden rounded-2xl bg-black/80">
              {previewImageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewImageUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-70"
                />
              ) : (
                <div className="h-full min-h-[320px] bg-[var(--qr-bg-elevated)]" />
              )}
              <div className="qr-generate-sweep pointer-events-none absolute inset-0" />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/35">
                <Loader2 className="h-10 w-10 animate-spin text-[var(--qr-brand)]" />
                <p className="text-sm text-white/90">视频生成中…</p>
                <p className="px-4 text-center text-xs text-white/55">
                  通常需要 1～3 分钟，请保持此窗口打开
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {failed ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {result?.error ?? "生成失败"}
          </p>
        ) : null}

        {succeeded && outputUrl && isAudio && generateDraft ? (
          <QrAudioGenerateSuccess draft={generateDraft} outputUrl={outputUrl} />
        ) : null}

        {succeeded && outputUrl && !isAudio ? (
          <div className="overflow-hidden rounded-xl bg-black">
            {isVideo ? (
              <video
                src={outputUrl}
                controls
                autoPlay
                playsInline
                className="aspect-[9/16] max-h-[min(70vh,640px)] w-full object-contain"
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={outputUrl} alt="output" className="w-full object-contain" />
            )}
          </div>
        ) : null}

        {succeeded && isAudio ? (
          <p className="text-[11px] text-[var(--qr-text-muted)]">
            保存后将写入「我的作品」（含音色与 Prompt）
          </p>
        ) : null}

        {succeeded && !isAudio ? (
          <p className="text-sm text-[var(--qr-text-secondary)]">
            预览满意后，可保存至「我的作品」。
          </p>
        ) : null}

        {saveError ? (
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm ${
              saveAuthExpired
                ? "border-amber-500/35 bg-amber-500/10 text-amber-100"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            <p>{saveError}</p>
            {saveAuthExpired ? (
              <button
                type="button"
                className="qr-btn-secondary mt-2 text-xs"
                onClick={() => openQrSessionReconnect()}
              >
                重新连接 Book 账号
              </button>
            ) : null}
          </div>
        ) : null}

        {!generating ? (
          <div className="flex flex-wrap gap-2">
            {succeeded && logId ? (
              <button
                type="button"
                className="qr-btn-primary disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? "保存中…" : "保存为我的"}
              </button>
            ) : null}
            <button type="button" className="qr-btn-secondary" onClick={onClose}>
              关闭
            </button>
          </div>
        ) : null}
      </div>
    </QrModal>
  );
}
