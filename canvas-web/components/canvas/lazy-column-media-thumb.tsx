"use client";

import { useLazyMediaActive } from "@/lib/canvas/use-lazy-media-active";

/** 列表面板内小缩略图：进视口再加载 */
export function LazyColumnMediaThumb({
  url,
  alt,
  emptyLabel,
  className = "relative h-[88px] w-[140px] shrink-0 overflow-hidden rounded-md border border-white/10 bg-black/50",
}: {
  url?: string;
  alt: string;
  emptyLabel: string;
  className?: string;
}) {
  const { ref, active } = useLazyMediaActive("120px");

  if (!url) {
    return (
      <div
        className={`flex items-center justify-center border-dashed border-white/15 bg-black/30 text-[10px] text-[var(--canvas-muted)] ${className}`}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      {active ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="size-full object-contain"
        />
      ) : (
        <div className="size-full animate-pulse bg-white/[0.04]" aria-hidden />
      )}
    </div>
  );
}
