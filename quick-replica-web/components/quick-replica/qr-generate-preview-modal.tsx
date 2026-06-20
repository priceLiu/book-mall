"use client";

import { QrModal } from "@/components/quick-replica/qr-modal";
import type { QrGenerateJobResult } from "@/components/quick-replica/qr-workspace-panel";

type Props = {
  open: boolean;
  result: QrGenerateJobResult | null;
  onClose: () => void;
  onSaved: () => void;
};

export function QrGeneratePreviewModal({ open, result, onClose, onSaved }: Props) {
  const failed = result?.status === "FAILED";
  const succeeded = result?.status === "SUCCEEDED" && result.template;
  const outputUrl = result?.outputUrl ?? result?.template?.output?.url;
  const isVideo = result?.template?.output?.mediaType === "video";

  return (
    <QrModal
      open={open}
      onClose={onClose}
      title={failed ? "产生失败" : "产生完成"}
      variant="square"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        {failed ? (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {result?.error ?? "生成失败"}
          </p>
        ) : null}

        {succeeded && outputUrl ? (
          <div className="overflow-hidden rounded-xl bg-zinc-900">
            {isVideo ? (
              <video src={outputUrl} controls className="aspect-video w-full" />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={outputUrl} alt="output" className="w-full object-contain" />
            )}
          </div>
        ) : null}

        {succeeded && result?.template ? (
          <p className="text-sm text-zinc-300">
            已保存至模板库：{result.template.title}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {succeeded ? (
            <button type="button" className="qr-btn-primary" onClick={() => {
                onSaved();
                onClose();
              }}
            >
              完成
            </button>
          ) : null}
          <button
            type="button"
            className="qr-btn-secondary"
            onClick={onClose}
          >
            关闭
          </button>
        </div>
      </div>
    </QrModal>
  );
}
