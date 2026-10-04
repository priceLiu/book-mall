"use client";

import { useCallback, useState } from "react";

/** 与 model-shot-ref-uploader / EcomRefUploadCard 标题行按钮一致 */
export const ECOM_REF_CARD_ACTION_BTN = "h-7 px-2 text-[10px]";

/** 参考图上传进度（与 model-shot-content-panel handleRefUpload 一致） */
export function useEcomRefUploadProgress() {
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const runWithUploadProgress = useCallback(
    async (slot: string, fn: () => Promise<void>) => {
      setUploadingSlot(slot);
      setUploadProgress(10);
      const tick = window.setInterval(() => {
        setUploadProgress((p) => (p != null && p < 88 ? p + 7 : p));
      }, 180);
      try {
        await fn();
        setUploadProgress(100);
      } finally {
        window.clearInterval(tick);
        setUploadingSlot(null);
        window.setTimeout(() => setUploadProgress(null), 450);
      }
    },
    [],
  );

  return { uploadingSlot, uploadProgress, runWithUploadProgress };
}

export function buildRefPreviewItems(
  items: Array<{ ossUrl: string; label: string }>,
): Array<{ src: string; title: string; thumbSrc: string }> {
  return items
    .filter((i) => i.ossUrl?.trim())
    .map((i) => ({
      src: i.ossUrl,
      title: i.label,
      thumbSrc: i.ossUrl,
    }));
}
