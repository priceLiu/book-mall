"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  originalUrl: string | null;
  children: React.ReactNode;
  originalLabel?: string;
  resultLabel?: string;
  className?: string;
  sessionCount?: number;
  sessionIndex?: number;
  onSessionPrev?: () => void;
  onSessionNext?: () => void;
  /** 把左边当前图放到右边编辑区 */
  canSendToEditor?: boolean;
  sendToEditorDisabled?: boolean;
  onSendToEditor?: () => void;
};

const FROSTED_CIRCLE =
  "inline-flex items-center justify-center rounded-full border border-white/35 bg-[#4b5563]/55 text-white shadow-[0_6px_20px_rgba(17,24,39,0.28)] backdrop-blur-xl backdrop-saturate-150 transition-[transform,background-color,box-shadow] hover:bg-[#374151]/70 hover:shadow-[0_8px_24px_rgba(17,24,39,0.36)] active:scale-95";

function FrostedNavButton({
  side,
  label,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        FROSTED_CIRCLE,
        "absolute top-1/2 z-10 h-12 w-12 -translate-y-1/2",
        "disabled:cursor-default disabled:opacity-40 disabled:shadow-none disabled:hover:bg-[#4b5563]/55",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      {side === "left" ? (
        <ChevronLeft className="h-6 w-6" strokeWidth={2.25} />
      ) : (
        <ChevronRight className="h-6 w-6" strokeWidth={2.25} />
      )}
    </button>
  );
}

function OriginalPane({ url }: { url: string }) {
  const paneRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = paneRef.current;
    if (!el) return;
    const update = () => {
      const w = Math.max(0, Math.floor(el.clientWidth));
      const h = Math.max(0, Math.floor(el.clientHeight));
      setBox((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={paneRef}
      className="flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden bg-[#f3f4f6]"
    >
      <img
        src={url}
        alt="原图"
        className="block h-auto w-auto max-h-full max-w-full select-none object-contain"
        style={box && box.w > 0 && box.h > 0 ? { maxWidth: box.w, maxHeight: box.h } : undefined}
        draggable={false}
      />
    </div>
  );
}

export function ImageLayerCompareStage({
  originalUrl,
  children,
  originalLabel = "原图",
  resultLabel = "操作 / 结果",
  className,
  sessionCount = 0,
  sessionIndex = 0,
  onSessionPrev,
  onSessionNext,
  canSendToEditor = false,
  sendToEditorDisabled = false,
  onSendToEditor,
}: Props) {
  const showCount = sessionCount > 0;
  const canFlip = sessionCount > 1 && Boolean(onSessionPrev && onSessionNext);
  const showNav = Boolean(originalUrl) && Boolean(onSessionPrev && onSessionNext);

  return (
    <div
      className={cn(
        "grid h-full min-h-0 min-w-0 w-full grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:gap-0",
        className,
      )}
    >
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white md:mr-0">
        <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-[#e5e7eb] px-3">
          <p className="min-w-0 truncate text-xs font-medium text-[#6b7280]">
            {originalLabel}
            {showCount ? ` · ${sessionIndex + 1}/${sessionCount}` : ""}
          </p>
        </div>
        <div className="group relative min-h-0 flex-1 overflow-hidden">
          {originalUrl ? (
            <OriginalPane url={originalUrl} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#9ca3af]">
              暂无原图
            </div>
          )}
          {showNav ? (
            <>
              <FrostedNavButton
                side="left"
                label="上一张已保存图片"
                disabled={!canFlip}
                onClick={onSessionPrev!}
              />
              <FrostedNavButton
                side="right"
                label="下一张已保存图片"
                disabled={!canFlip}
                onClick={onSessionNext!}
              />
            </>
          ) : null}
        </div>
      </section>
      {canSendToEditor && onSendToEditor ? (
        <div className="relative flex w-full flex-col items-center justify-center gap-1.5 py-2 md:w-16 md:shrink-0 md:py-0">
          <button
            type="button"
            aria-label="放到编辑区"
            title={sendToEditorDisabled ? "已在右边编辑区" : "把左边这张放到右边继续编辑"}
            disabled={sendToEditorDisabled}
            onClick={onSendToEditor}
            className={cn(
              FROSTED_CIRCLE,
              "relative z-10 h-14 w-14 md:absolute md:left-1/2 md:top-[22%] md:-translate-x-1/2 md:-translate-y-1/2",
              "disabled:cursor-default disabled:opacity-35 disabled:shadow-none disabled:hover:bg-[#4b5563]/55",
            )}
          >
            <ArrowRight className="h-7 w-7" strokeWidth={2.25} />
          </button>
          <span className="relative z-10 w-max text-[11px] font-medium text-[#6b7280] md:absolute md:left-1/2 md:top-[calc(22%+2.1rem)] md:-translate-x-1/2">
            放到编辑区
          </span>
        </div>
      ) : (
        <div className="hidden md:block md:w-3" />
      )}
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="flex h-8 shrink-0 items-center border-b border-[#e5e7eb] px-3 text-xs font-medium text-[#6b7280]">
          {resultLabel}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </section>
    </div>
  );
}
