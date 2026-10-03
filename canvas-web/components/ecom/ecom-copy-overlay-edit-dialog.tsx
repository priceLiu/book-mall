"use client";

import { useState } from "react";

import {
  EcomCopyOverlayCanvas,
  EcomCopyOverlayLayerControls,
  EcomCopyOverlayLayersEditor,
  overlayHasAnyCopy,
  useEcomCopyOverlayEditorState,
  type EcomCopyOverlay,
} from "@private/ecom-copy-overlay";

import { composeEcomCopyOverlayViaBook } from "@/lib/ecom/copy-overlay-compose-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  baseImageUrl: string;
  initialText?: string;
  overlay?: EcomCopyOverlay | null;
  exportWidthPx?: number;
  aspectClassName?: string;
  onComposed?: (url: string, overlay: EcomCopyOverlay) => void;
};

/**
 * 画布图片节点：与电商排版弹层共用多文案块编辑 + book-mall 合成 API。
 */
export function EcomCopyOverlayEditDialog({
  open,
  onOpenChange,
  title = "烧字排版",
  baseImageUrl,
  initialText = "",
  overlay: overlayProp = null,
  exportWidthPx = 750,
  aspectClassName = "aspect-[3/4]",
  onComposed,
}: Props) {
  const {
    overlay,
    setOverlay,
    selectedLayerId,
    setSelectedLayerId,
    selectedLayer,
  } = useEcomCopyOverlayEditorState({
    open,
    initialText,
    overlayProp,
    exportWidthPx,
    baseImageUrl,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-[#1c1c1e] text-white shadow-xl">
        <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold">{title}</div>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row">
          <div className="mx-auto w-full max-w-[320px] shrink-0">
            <EcomCopyOverlayCanvas
              baseImageUrl={baseImageUrl}
              aspectClassName={aspectClassName}
              overlay={overlay}
              onChange={setOverlay}
              selectedLayerId={selectedLayerId}
              onSelectLayer={setSelectedLayerId}
            />
            <EcomCopyOverlayLayerControls
              overlay={overlay}
              selectedLayer={selectedLayer}
              onChange={setOverlay}
              className="mt-3 [&_label]:text-white/60 [&_input]:border-white/20 [&_input]:bg-black/40 [&_select]:border-white/20 [&_select]:bg-black/40"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <EcomCopyOverlayLayersEditor
              variant="dark"
              overlay={overlay}
              onChange={setOverlay}
              selectedLayerId={selectedLayerId}
              onSelectLayerId={setSelectedLayerId}
              disabled={busy}
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-4 py-3">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-white/70 hover:bg-white/10"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            取消
          </button>
          <button
            type="button"
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium hover:bg-violet-500 disabled:opacity-50"
            disabled={busy || !overlayHasAnyCopy(overlay)}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await composeEcomCopyOverlayViaBook({
                    baseImageUrl,
                    overlay,
                    exportWidthPx,
                  });
                  onComposed?.(result.url, result.overlay);
                  onOpenChange(false);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "合成失败");
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            {busy ? "合成中…" : "合成"}
          </button>
        </div>
      </div>
    </div>
  );
}
