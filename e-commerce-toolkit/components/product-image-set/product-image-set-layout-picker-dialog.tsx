"use client";

import { Check, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useDialogs } from "@/components/dialogs/dialog-provider";
import { ProductImageSetLayoutRefUpload } from "@/components/product-image-set/product-image-set-layout-ref-upload";
import { EcomButtonPrimary } from "@/components/ui/ecom-button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EcomDialogCloseButton,
} from "@/components/ui/dialog";
import { fetchEcomStylePresets } from "@/lib/ecom-style-preset-api";
import type { EcomStylePreset } from "@/lib/ecom-style-preset-types";
import type { EcomStylePresetVertical } from "@/lib/ecom-style-preset-types";
import { ecomStylePresetDisplayThumbUrl } from "@/lib/ecom-style-preset-thumb-url";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onClose: () => void;
  projectId: string;
  vertical: EcomStylePresetVertical;
  maxSelect: number;
  selectedIds: string[];
  onApply: (ids: string[]) => void | Promise<void>;
};

function LayoutPresetThumb({ preset }: { preset: EcomStylePreset }) {
  const [failed, setFailed] = useState(false);
  const thumb = failed ? undefined : ecomStylePresetDisplayThumbUrl(preset);
  if (!thumb) {
    return (
      <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#f0f6ff] to-[#e8e8ed] px-2 text-center text-[11px] text-[#86868b]">
        {preset.title}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumb}
      alt=""
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export function ProductImageSetLayoutPickerDialog({
  open,
  onClose,
  projectId,
  vertical,
  maxSelect,
  selectedIds,
  onApply,
}: Props) {
  const { alert } = useDialogs();
  const [presets, setPresets] = useState<EcomStylePreset[]>([]);
  const [draft, setDraft] = useState<string[]>(selectedIds);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(selectedIds);
    setLoading(true);
    void fetchEcomStylePresets({ kind: "sellpoint_layout", vertical, limit: 40 })
      .then((r) => setPresets(r.presets))
      .catch((e) =>
        void alert({
          title: "加载版式库失败",
          message: e instanceof Error ? e.message : "请稍后重试",
          variant: "error",
        }),
      )
      .finally(() => setLoading(false));
  }, [open, vertical, selectedIds, alert]);

  const toggle = useCallback(
    (id: string) => {
      setDraft((prev) => {
        if (prev.includes(id)) return prev.filter((x) => x !== id);
        if (prev.length >= maxSelect) {
          void alert({
            title: "已达可选上限",
            message: `卖点图结构为 ${maxSelect} 张，最多选择 ${maxSelect} 种版式。`,
          });
          return prev;
        }
        return [...prev, id];
      });
    },
    [maxSelect, alert],
  );

  const selectedPresets = useMemo(
    () => draft.map((id) => presets.find((p) => p.id === id)).filter(Boolean) as EcomStylePreset[],
    [draft, presets],
  );

  const commitAndClose = useCallback(async () => {
    await onApply(draft);
    onClose();
  }, [draft, onApply, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && void commitAndClose()}>
      <DialogContent className="flex max-h-[90vh] w-[min(1024px,calc(100vw-2rem))] max-w-[1024px] flex-col gap-0 p-0">
        <DialogHeader className="border-b border-[#e8e8ed] px-5 py-3.5">
          <DialogTitle className="text-base font-semibold">选择卖点图版式</DialogTitle>
          <EcomDialogCloseButton type="button" onClick={() => void commitAndClose()} />
        </DialogHeader>
        <div className="flex min-h-[420px] min-h-0 flex-1 flex-col md:flex-row">
          <div className="ecom-scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 md:max-h-[560px]">
            {loading ? (
              <p className="text-sm text-[#86868b]">加载预置版式库…</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {presets.map((p) => {
                  const on = draft.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "group relative overflow-hidden rounded-xl border-2 text-left transition",
                        on
                          ? "border-[#3086fc] shadow-[inset_0_0_0_1px_rgba(48,134,252,0.2)]"
                          : "border-transparent hover:border-[#c7c7cc]",
                      )}
                      onClick={() => toggle(p.id)}
                    >
                      <div className="relative aspect-[4/5] w-full bg-[#f5f5f7]">
                        <LayoutPresetThumb preset={p} />
                        <div
                          className={cn(
                            "pointer-events-none absolute inset-0 bg-[#3086fc]/10 transition",
                            on ? "opacity-100" : "opacity-0 group-hover:opacity-30",
                          )}
                        />
                        <span
                          className={cn(
                            "absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 transition",
                            on
                              ? "border-[#3086fc] bg-[#3086fc] text-white"
                              : "border-white/80 bg-black/20 text-transparent",
                          )}
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <ProductImageSetLayoutRefUpload projectId={projectId} disabled={loading} />
          </div>
          <aside className="flex w-full shrink-0 flex-col border-t border-[#e8e8ed] bg-[#fafafa] md:w-[280px] md:border-l md:border-t-0">
            <div className="border-b border-[#e8e8ed] px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-[#1d1d1f]">已选版式</p>
                <span className="text-xs text-[#86868b]">
                  {draft.length}/{maxSelect}
                </span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#86868b]">
                每种版式生成 1 张，剩余卖点图 AI 补齐。
              </p>
            </div>
            <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {selectedPresets.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg border border-[#e8e8ed] bg-white p-2"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md bg-[#f5f5f7]">
                      <LayoutPresetThumb preset={p} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-[#1d1d1f]">{p.title}</p>
                      <p className="text-[10px] text-[#86868b]">生成 1 张</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-[#939599] hover:text-[#1d1d1f]"
                      onClick={() => toggle(p.id)}
                      aria-label={`移除${p.title}`}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
              ))}
            </div>
            <div className="border-t border-[#e8e8ed] p-3">
              <EcomButtonPrimary
                size="sm"
                className="w-full"
                type="button"
                onClick={() => void commitAndClose()}
              >
                {draft.length > 0 ? `应用 ${draft.length} 个版式` : "不选版式，关闭"}
              </EcomButtonPrimary>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}
