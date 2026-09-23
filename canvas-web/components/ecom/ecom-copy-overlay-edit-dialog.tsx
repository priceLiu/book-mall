"use client";

import {
  EcomCopyOverlayCanvas,
  EcomCopyOverlayLayerControls,
  resolveOverlayForEditor,
  syncOverlayMainLayerText,
  type EcomCopyOverlay,
} from "@private/ecom-copy-overlay";
import { useEffect, useState } from "react";

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
 * 画布图片节点等场景：复用 @private/ecom-copy-overlay 编辑 + book-mall 合成 API。
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
  const [text, setText] = useState(initialText);
  const [overlay, setOverlay] = useState<EcomCopyOverlay>(() =>
    resolveOverlayForEditor({
      overlay: overlayProp,
      text: initialText,
      exportWidthPx,
      baseImageUrl,
    }),
  );
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>("main");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedLayer = overlay.layers.find((l) => l.id === selectedLayerId) ?? overlay.layers[0];

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setOverlay(
      resolveOverlayForEditor({
        overlay: overlayProp,
        text: initialText,
        exportWidthPx,
        baseImageUrl,
      }),
    );
    setError(null);
  }, [open, initialText, overlayProp, exportWidthPx, baseImageUrl]);

  useEffect(() => {
    if (!open) return;
    setOverlay((prev) => syncOverlayMainLayerText(prev, text));
  }, [text, open]);

  return open ? (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-[#1c1c1e] text-white shadow-xl">
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
            <label className="block text-xs text-white/60">
              文案
              <textarea
                className="mt-1 min-h-[120px] w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
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
            disabled={busy || !text.trim()}
            onClick={() => {
              void (async () => {
                setBusy(true);
                setError(null);
                try {
                  const result = await composeEcomCopyOverlayViaBook({
                    baseImageUrl,
                    overlay,
                    syncText: text,
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
  ) : null;
}
