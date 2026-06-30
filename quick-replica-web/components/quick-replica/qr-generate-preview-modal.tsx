"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { QrModal } from "@/components/quick-replica/qr-modal";
import type { QrGenerateJobResult } from "@/components/quick-replica/qr-workspace-panel";
import { saveQrGenerateJobToMyWorks } from "@/lib/run-qr-generate-job";

export type QrGenerateModalPhase = "generating" | "success" | "failed";

type Props = {
  open: boolean;
  phase: QrGenerateModalPhase;
  result: QrGenerateJobResult | null;
  logId?: string | null;
  previewImageUrl?: string;
  onClose: () => void;
  onSaved: (template: NonNullable<QrGenerateJobResult["template"]>) => void;
};

export function QrGeneratePreviewModal({
  open,
  phase,
  result,
  logId,
  previewImageUrl,
  onClose,
  onSaved,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const outputUrl = result?.outputUrl ?? result?.template?.output?.url;
  const isVideo =
    result?.template?.output?.mediaType === "video" ||
    Boolean(outputUrl?.includes(".mp4") || outputUrl?.includes(".webm"));
  const generating = phase === "generating";
  const failed = phase === "failed";
  const succeeded = phase === "success" && Boolean(outputUrl);

  const title = generating ? "产生中" : failed ? "产生失败" : "产生完成";

  const handleSave = async () => {
    if (!logId) return;
    setSaving(true);
    setSaveError(null);
    const saved = await saveQrGenerateJobToMyWorks(logId);
    setSaving(false);
    if (saved.error || !saved.template) {
      setSaveError(saved.error ?? "保存失败");
      return;
    }
    onSaved(saved.template);
    onClose();
  };

  return (
    <QrModal
      open={open}
      onClose={generating ? () => {} : onClose}
      title={title}
      variant="square"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {generating ? (
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

        {succeeded && outputUrl ? (
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

        {succeeded ? (
          <p className="text-sm text-[var(--qr-text-secondary)]">
            预览满意后，可保存至「我的作品」。
          </p>
        ) : null}

        {saveError ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {saveError}
          </p>
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
