"use client";

import { Download, Loader2, Save } from "lucide-react";
import { useState } from "react";

import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import { imageLayerComposeImageSrc } from "@/lib/image-layer-compose-image-src";
import { downloadImageLayerUrl } from "@/lib/image-layer-download";
import {
  buildSaveItems,
  type ImageLayerSaveItem,
} from "@/lib/image-layer-save-items";
import type { ImageLayerStack } from "@/lib/image-layer-types";

export type { ImageLayerSaveItem };

export function ImageLayerSaveDialog({
  open,
  sourceUrl,
  originalImageUrl,
  stack,
  saveWorkspaceBusy,
  saveLibraryBusy,
  onOpenChange,
  onSaveWorkspace,
  onSaveToLibrary,
}: {
  open: boolean;
  sourceUrl: string | null;
  originalImageUrl?: string | null;
  stack: ImageLayerStack | null;
  saveWorkspaceBusy?: boolean;
  saveLibraryBusy?: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveWorkspace: () => Promise<void>;
  onSaveToLibrary?: (item: ImageLayerSaveItem) => Promise<void>;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const items = buildSaveItems(sourceUrl, stack, originalImageUrl);
  const resultItem = items.find((item) => item.id === "flat") ?? null;
  const anyBusy = Boolean(saveWorkspaceBusy || saveLibraryBusy || downloadingId);

  async function downloadOne(item: ImageLayerSaveItem) {
    setError(null);
    setDownloadingId(item.id);
    try {
      await downloadImageLayerUrl(item.url, item.filename);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloadingId(null);
    }
  }

  async function downloadAll() {
    setError(null);
    for (const item of items) {
      setDownloadingId(item.id);
      try {
        await downloadImageLayerUrl(item.url, item.filename);
      } catch (e) {
        setError(e instanceof Error ? e.message : "下载失败");
        break;
      }
    }
    setDownloadingId(null);
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="image-layer-save-title"
      onClick={() => {
        if (!anyBusy) onOpenChange(false);
      }}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#e8e8ed] bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <EcomDialogCloseButton disabled={anyBusy} onClick={() => onOpenChange(false)} />
        <div className="border-b border-[#e8e8ed] px-5 py-4 pr-12">
          <h2 id="image-layer-save-title" className="text-base font-semibold text-[#1d1d1f]">
            保存图片
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-[#6e6e73]">
            改层 / 重绘 / 擦除后的新图可下载，或保存到「我的资产 · 图片分层」。
          </p>
        </div>

        <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {resultItem ? (
            <div className="mb-4 overflow-hidden rounded-xl border border-[#e5e7eb] bg-[#f5f5f7]">
              <img
                src={imageLayerComposeImageSrc(resultItem.url)}
                alt="当前结果图"
                className="mx-auto max-h-52 object-contain"
              />
            </div>
          ) : null}
          {items.length === 0 ? (
            <p className="text-sm text-[#9ca3af]">暂无可下载的图片，请先上传或完成处理。</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2.5"
                >
                  <span className="min-w-0 truncate text-sm text-[#374151]">{item.label}</span>
                  <EcomButtonSecondary
                    type="button"
                    size="sm"
                    className="shrink-0"
                    disabled={anyBusy}
                    onClick={() => void downloadOne(item)}
                  >
                    {downloadingId === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    下载
                  </EcomButtonSecondary>
                </li>
              ))}
            </ul>
          )}
          {error ? <p className="mt-3 text-xs text-[#dc2626]">{error}</p> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[#e8e8ed] px-5 py-4">
          {items.length > 1 ? (
            <EcomButtonSecondary
              type="button"
              disabled={anyBusy}
              onClick={() => void downloadAll()}
            >
              全部下载
            </EcomButtonSecondary>
          ) : null}
          <EcomButtonSecondary
            type="button"
            disabled={anyBusy}
            onClick={() => void onSaveWorkspace().then(() => onOpenChange(false))}
          >
            {saveWorkspaceBusy ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            同步工作区
          </EcomButtonSecondary>
          {resultItem && onSaveToLibrary ? (
            <EcomButtonPrimary
              type="button"
              disabled={anyBusy}
              onClick={() =>
                void onSaveToLibrary(resultItem)
                  .then(() => onOpenChange(false))
                  .catch((e: unknown) => {
                    setError(e instanceof Error ? e.message : "保存失败");
                  })
              }
            >
              {saveLibraryBusy ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              保存到我的资产
            </EcomButtonPrimary>
          ) : null}
        </div>
      </div>
    </div>
  );
}
