"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Props = {
  originalUrl: string | null;
  children: React.ReactNode;
  originalLabel?: string;
  resultLabel?: string;
  className?: string;
};

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
}: Props) {
  return (
    <div
      className={cn(
        "grid h-full min-h-0 min-w-0 w-full grid-cols-1 gap-3 md:grid-cols-2",
        className,
      )}
    >
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="shrink-0 border-b border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#6b7280]">
          {originalLabel}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          {originalUrl ? (
            <OriginalPane url={originalUrl} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#9ca3af]">
              暂无原图
            </div>
          )}
        </div>
      </section>
      <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e5e7eb] bg-white">
        <div className="shrink-0 border-b border-[#e5e7eb] px-3 py-1.5 text-xs font-medium text-[#6b7280]">
          {resultLabel}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </section>
    </div>
  );
}
