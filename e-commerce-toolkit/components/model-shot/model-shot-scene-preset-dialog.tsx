"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import { EcomDialogCloseButton } from "@/components/ui/dialog";
import {
  ecomModalBackdropMouseDown,
  useEcomModalEscape,
} from "@/components/ui/ecom-modal-layer";
import {
  listModelShotScenePresets,
  type ModelShotScenePreset,
} from "@/lib/model-shot-prompt-presets";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  busy?: boolean;
  selectedCatalogId?: string | null;
  onConfirm: (preset: ModelShotScenePreset) => void | Promise<void>;
};

export function ModelShotScenePresetDialog({
  open,
  onClose,
  busy,
  selectedCatalogId,
  onConfirm,
}: Props) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ModelShotScenePreset | null>(null);
  const presets = useMemo(() => listModelShotScenePresets(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return presets;
    return presets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.visualPrompt.toLowerCase().includes(q),
    );
  }, [presets, query]);

  useEcomModalEscape(open, onClose, { disabled: busy });

  if (!open || typeof document === "undefined") return null;

  const activeId = picked?.id ?? selectedCatalogId ?? null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="model-shot-scene-preset-title"
      onMouseDown={ecomModalBackdropMouseDown(onClose, { disabled: busy })}
    >
      <div
        className="relative flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <EcomDialogCloseButton disabled={busy} onClick={onClose} />
        <div className="border-b border-[#e5e5ea] px-5 py-4 pr-14">
          <h3 id="model-shot-scene-preset-title" className="text-base font-semibold text-[#1d1d1f]">
            场景词库
          </h3>
          <p className="mt-1 text-xs text-[#86868b]">
            选中后作为项目级场景描述（无参考图时写入采集信息）。
          </p>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
          <input
            className="w-full rounded-lg border border-[#e8e8ed] px-3 py-2 text-sm"
            placeholder="搜索场景"
            value={query}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="ecom-scrollbar-thin max-h-[45vh] space-y-1.5 overflow-y-auto">
            {filtered.map((s) => (
              <button
                key={s.id}
                type="button"
                disabled={busy}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-left text-[11px] transition",
                  activeId === s.id
                    ? "border-[var(--ecom-outline-border)] bg-[#f0f6ff]"
                    : "border-[#e8e8ed] hover:bg-[#fafafa]",
                )}
                onClick={() => setPicked(s)}
              >
                <p className="font-medium text-[#1d1d1f]">{s.name}</p>
                <p className="mt-0.5 line-clamp-2 text-[10px] text-[#86868b]">{s.visualPrompt}</p>
              </button>
            ))}
          </div>
        </div>
        <div className="border-t border-[#e8e8ed] p-4">
          <EcomButtonPrimary
            type="button"
            size="sm"
            className="w-full"
            disabled={busy || !picked}
            onClick={() => {
              if (!picked) return;
              void Promise.resolve(onConfirm(picked)).then(onClose);
            }}
          >
            使用该场景
          </EcomButtonPrimary>
        </div>
      </div>
    </div>,
    document.body,
  );
}