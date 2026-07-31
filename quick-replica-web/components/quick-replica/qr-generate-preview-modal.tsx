"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

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
  /** 已在「我的作品」中保存过则关闭时不再提示 */
  alreadySaved?: boolean;
  onClose: () => void;
  onSaved: (template: NonNullable<QrGenerateJobResult["template"]>) => void;
};

function isAudioOutput(
  outputUrl: string | undefined,
  result: QrGenerateJobResult | null,
  draft: QrWorkspaceDraft | null | undefined,
): boolean {
  if (draft?.category === "audio") return true;
  if (draft && isQrTextToAudioKind(draft)) return true;
  if (
    draft?.kind === "create-voiceover" ||
    draft?.kind === "voice-changer" ||
    draft?.kind === "create-sfx" ||
    draft?.kind === "create-music" ||
    draft?.kind === "voice-clone"
  ) {
    return true;
  }
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
  alreadySaved = false,
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveAuthExpired, setSaveAuthExpired] = useState(false);
  const [savedLocally, setSavedLocally] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) {
      setSaving(false);
      setSaveError(null);
      setSaveAuthExpired(false);
      setSavedLocally(false);
      setConfirmDiscard(false);
    }
  }, [open]);

  const outputUrl = result?.outputUrl ?? result?.template?.output?.url;
  const isVideo =
    !isAudioOutput(outputUrl, result, generateDraft) &&
    (result?.template?.output?.mediaType === "video" ||
      Boolean(outputUrl?.includes(".mp4") || outputUrl?.includes(".webm")));
  const isAudio = isAudioOutput(outputUrl, result, generateDraft);
  const generating = phase === "generating";
  const failed = phase === "failed";
  const succeeded = phase === "success" && Boolean(outputUrl);
  const needsSavePrompt =
    succeeded && Boolean(logId) && !alreadySaved && !savedLocally;

  const title = generating
    ? "产生中"
    : failed
      ? "产生失败"
      : confirmDiscard
        ? "尚未保存"
        : "产生完成";

  const handleSave = async (): Promise<boolean> => {
    if (!logId) return false;
    setSaving(true);
    setSaveError(null);
    setSaveAuthExpired(false);
    const saved = await saveQrGenerateJobToMyWorks(logId);
    setSaving(false);
    if (saved.error || !saved.template) {
      const msg = formatQrPlatformError(saved.error);
      setSaveError(msg);
      setSaveAuthExpired(isQrAuthError(saved.error));
      return false;
    }
    setSavedLocally(true);
    setConfirmDiscard(false);
    onSaved(saved.template);
    onClose();
    return true;
  };

  const requestClose = () => {
    if (generating) return;
    if (needsSavePrompt && !confirmDiscard) {
      setConfirmDiscard(true);
      return;
    }
    setConfirmDiscard(false);
    onClose();
  };

  const audioGenerating = generating && isAudio;
  const loadingHint =
    generateDraft?.category === "world"
      ? "场景生成中…"
      : generateDraft?.category === "image" || generateDraft?.category === "character"
        ? "图像生成中…"
        : generateDraft?.category === "audio"
          ? "音频生成中…"
          : "视频生成中…";
  const loadingEta =
    generateDraft?.category === "world"
      ? "3D 场景通常需要数分钟，请保持此窗口打开"
      : "通常需要 1～3 分钟，请保持此窗口打开";

  return (
    <QrModal
      open={open}
      onClose={generating ? () => {} : requestClose}
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
                <p className="text-sm text-white/90">{loadingHint}</p>
                <p className="px-4 text-center text-xs text-white/55">{loadingEta}</p>
              </div>
            </div>
          </div>
        ) : null}

        {failed ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {result?.error ?? "生成失败"}
          </p>
        ) : null}

        {succeeded && outputUrl && isAudio && generateDraft && !confirmDiscard ? (
          <QrAudioGenerateSuccess draft={generateDraft} outputUrl={outputUrl} />
        ) : null}

        {succeeded && outputUrl && !isAudio && !confirmDiscard ? (
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

        {confirmDiscard ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-50">
            <p className="font-medium text-amber-100">还没有保存到「我的作品」</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-amber-100/80">
              关闭后可在侧栏「生成记录」中再次打开本条结果。建议先保存，方便在「我的作品」里复用。
            </p>
          </div>
        ) : null}

        {succeeded && isAudio && !confirmDiscard ? (
          <p className="text-[11px] text-[var(--qr-text-muted)]">
            保存后将写入「我的作品」（含音色与 Prompt）
          </p>
        ) : null}

        {succeeded && !isAudio && !confirmDiscard ? (
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
            {confirmDiscard ? (
              <>
                <button
                  type="button"
                  className="qr-btn-primary disabled:opacity-50"
                  disabled={saving || !logId}
                  onClick={() => void handleSave()}
                >
                  {saving ? "保存中…" : "保存并关闭"}
                </button>
                <button
                  type="button"
                  className="qr-btn-secondary"
                  disabled={saving}
                  onClick={() => {
                    setConfirmDiscard(false);
                    onClose();
                  }}
                >
                  不保存，关闭
                </button>
                <button
                  type="button"
                  className="qr-btn-secondary"
                  disabled={saving}
                  onClick={() => setConfirmDiscard(false)}
                >
                  继续预览
                </button>
              </>
            ) : (
              <>
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
                <button
                  type="button"
                  className="qr-btn-secondary"
                  onClick={requestClose}
                >
                  关闭
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </QrModal>
  );
}
