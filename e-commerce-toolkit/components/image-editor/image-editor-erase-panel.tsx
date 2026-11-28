"use client";

import { ChevronDown, ChevronUp, Eraser, Minus, Plus, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

export const ERASE_TARGETS = [
  { id: "text", label: "文字", notice: "文字", prompt: "文字" },
  { id: "watermark", label: "水印", notice: "水印", prompt: "水印" },
  { id: "passerby", label: "路人", notice: "路人", prompt: "路人" },
  { id: "glasses", label: "眼镜", notice: "眼镜", prompt: "眼镜" },
  { id: "glare", label: "反光", notice: "反光", prompt: "反光" },
  { id: "logo", label: "Logo", notice: "Logo", prompt: "Logo 和标志" },
] as const;

export type EraseTargetId = (typeof ERASE_TARGETS)[number]["id"];
export type EraseSelectTool = "brush" | "box" | "lasso";

type Props = {
  tab: "manual" | "ai";
  onTab: (tab: "manual" | "ai") => void;
  targets: Record<string, boolean>;
  onToggleTarget: (id: EraseTargetId) => void;
  selectTool: EraseSelectTool;
  onSelectTool: (tool: EraseSelectTool) => void;
  brushSize: number;
  onBrushSize: (size: number) => void;
  busy: boolean;
  onClear: () => void;
  onReset: () => void;
  onStart: () => void;
};

const SELECT_TOOLS: Array<{ id: EraseSelectTool; label: string }> = [
  { id: "brush", label: "涂抹" },
  { id: "box", label: "框选" },
  { id: "lasso", label: "圈选" },
];

export function ImageEditorErasePanel({
  tab,
  onTab,
  targets,
  onToggleTarget,
  selectTool,
  onSelectTool,
  brushSize,
  onBrushSize,
  busy,
  onClear,
  onReset,
  onStart,
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
                        on ? "bg-[var(--ie-ink)]" : "bg-[#d9d1c6]",
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
              className="w-full accent-[var(--ie-ink)]"
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </section>
        )}

        {tab === "ai" ? (
        <section>
          <div className="text-sm font-medium text-[var(--ie-ink)]">选区工具</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SELECT_TOOLS.map((item) => {
              const active = selectTool === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={active}
                  disabled={busy}
                  className={cn(
                    "flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-xl border text-[13px] disabled:opacity-50",
                    active
                      ? "border-[var(--ie-ink)] bg-white text-[var(--ie-ink)]"
                      : "border-transparent bg-[var(--ie-cream-muted)] text-[var(--ie-muted)]",
                  )}
                  onClick={() => onSelectTool(item.id)}
                >
                  <SelectToolIcon id={item.id} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              aria-label="增大画笔"
              disabled={busy}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--ie-ink)] text-white disabled:opacity-50"
              onClick={() => setSize(brushSize + 4)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="减小画笔"
              disabled={busy}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#d9d1c6] text-[var(--ie-muted)] disabled:opacity-50"
              onClick={() => setSize(brushSize - 4)}
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <input
              type="range"
              min={8}
              max={120}
              value={brushSize}
              aria-label="画笔大小滑杆"
              disabled={busy}
              className="min-w-0 flex-1 accent-[var(--ie-ink)]"
              onChange={(e) => setSize(Number(e.target.value))}
            />
            <button
              type="button"
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1 text-[13px] text-[var(--ie-ink)] disabled:opacity-50"
              onClick={onClear}
            >
              <Eraser className="h-3.5 w-3.5" aria-hidden />
              清空
            </button>
          </div>
        </section>
        ) : null}
      </div>
      <div className="flex gap-2 border-t border-[var(--ie-border-soft)] p-3">
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--ie-border)] bg-[var(--ie-cream)] text-[13px] text-[var(--ie-ink)] disabled:opacity-50"
          onClick={onReset}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          重置
        </button>
        {tab === "ai" ? (
          <button
            type="button"
            disabled={busy}
            className="h-10 flex-1 rounded-lg bg-[var(--ecom-btn-fill)] text-[13px] font-medium text-[var(--ecom-btn-on-fill)] hover:bg-[var(--ecom-btn-fill-hover)] disabled:opacity-50"
            onClick={onStart}
          >
            开始消除
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SelectToolIcon({ id }: { id: EraseSelectTool }) {
  if (id === "brush") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M8 11.5c.2-2 1.2-3.4 2.4-4.2.6 1.2 1.6 1.8 2.6 1.7-1 1.6-.6 3.2.2 4.4" strokeLinecap="round" />
        <path d="M9.2 13.2c-1.6 1.5-2.4 3.2-2.2 4.6 1.6.2 3.2-.6 4.6-2.1" strokeLinecap="round" />
        <path d="M14.2 7.2l1.2-2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (id === "box") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <rect x="5" y="5" width="14" height="14" rx="2" strokeDasharray="3 2.2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="7" strokeDasharray="3 2.2" />
    </svg>
  );
}
