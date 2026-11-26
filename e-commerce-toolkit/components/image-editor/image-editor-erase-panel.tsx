"use client";

import { ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

import { EcomButtonSecondary } from "@/components/ui/ecom-button";
import { cn } from "@/lib/utils";

export const ERASE_TARGETS = [
  { id: "text", label: "文字", notice: "文字", prompt: "文字" },
  { id: "watermark", label: "水印", notice: "水印", prompt: "水印" },
  { id: "passerby", label: "路人", notice: "路人", prompt: "路人" },
  { id: "glasses", label: "眼镜", notice: "眼镜", prompt: "眼镜" },
  { id: "glare", label: "反光", notice: "反光", prompt: "反光" },
  { id: "logo", label: "Logo 标志", notice: "Logo", prompt: "Logo 和标志" },
] as const;

export type EraseTargetId = (typeof ERASE_TARGETS)[number]["id"];

type Props = {
  tab: "manual" | "ai";
  onTab: (tab: "manual" | "ai") => void;
  targets: Record<string, boolean>;
  onToggleTarget: (id: EraseTargetId) => void;
  brushSize: number;
  onBrushSize: (size: number) => void;
  busy: boolean;
  onReset: () => void;
};

export function ImageEditorErasePanel({
  tab,
  onTab,
  targets,
  onToggleTarget,
  brushSize,
  onBrushSize,
  busy,
  onReset,
}: Props) {
  const setSize = (value: number) => onBrushSize(Math.min(120, Math.max(8, Math.round(value) || 8)));

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--ie-border-soft)] bg-[var(--ie-cream)] shadow-sm">
      <div className="ecom-scrollbar-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-2 rounded-xl bg-[var(--ie-cream-muted)] p-1">
          {(
            [
              ["manual", "手动消除"],
              ["ai", "AI 消除"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              disabled={busy}
              className={cn(
                "h-9 rounded-lg text-[13px]",
                tab === id ? "bg-[var(--ie-cream)] font-medium text-[var(--ie-ink)] shadow-sm" : "text-[var(--ie-muted)]",
              )}
              onClick={() => onTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "ai" ? (
          <section>
            <div className="text-sm font-medium text-[var(--ie-ink)]">自动消除</div>
            <p className="mt-1 text-[12px] text-[var(--ie-muted)]">打开开关，一键识别并消除。</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {ERASE_TARGETS.map((item) => {
                const on = Boolean(targets[item.id]);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-[var(--ie-cream-muted)] px-3 py-3"
                  >
                    <span className="text-[13px] text-[var(--ie-ink)]">{item.label}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={item.label}
                      disabled={busy}
                      className={cn(
                        "relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50",
                        on ? "bg-[#0071e3]" : "bg-[#d9d1c6]",
                      )}
                      onClick={() => onToggleTarget(item.id)}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all",
                          on ? "left-[18px]" : "left-0.5",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] text-[var(--ie-ink)]">画笔大小</span>
              <div className="flex items-center rounded-lg border border-[var(--ie-border)] bg-[var(--ie-cream)]">
                <input
                  type="number"
                  min={8}
                  max={120}
                  value={brushSize}
                  aria-label="画笔大小"
                  disabled={busy}
                  className="w-12 bg-transparent py-1 text-center text-[13px] text-[var(--ie-ink)] outline-none"
                  onChange={(e) => setSize(Number(e.target.value))}
                />
                <div className="flex flex-col border-l border-[var(--ie-border-soft)]">
                  <button
                    type="button"
                    aria-label="增大画笔"
                    disabled={busy}
                    className="px-1 text-[var(--ie-muted)]"
                    onClick={() => setSize(brushSize + 1)}
                  >
                    <ChevronUp className="h-3 w-3" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label="减小画笔"
                    disabled={busy}
                    className="px-1 text-[var(--ie-muted)]"
                    onClick={() => setSize(brushSize - 1)}
                  >
                    <ChevronDown className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              </div>
            </div>
            <input
              type="range"
              min={8}
              max={120}
              value={brushSize}
              aria-label="画笔大小滑杆"
              disabled={busy}
              className="w-full accent-[#0071e3]"
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </section>
        )}
      </div>
      {tab === "manual" ? (
        <div className="border-t border-[var(--ie-border-soft)] p-3">
          <EcomButtonSecondary type="button" className="w-full" disabled={busy} onClick={onReset}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            重置
          </EcomButtonSecondary>
        </div>
      ) : null}
    </div>
  );
}
