"use client";

import { useCallback, useState } from "react";

import { useIntersectionVisible } from "@/lib/use-intersection-visible";
import type { QrTemplate } from "@/lib/qr-template-types";

function readThumbHint(template: QrTemplate): { width: number; height: number } | null {
  const params = template.reference.model.params;
  const w = typeof params.thumb_width === "number" ? params.thumb_width : null;
  const h = typeof params.thumb_height === "number" ? params.thumb_height : null;
  if (w && h && w > 0 && h > 0) return { width: w, height: h };
  return null;
}

/** 世界场景墙：按图片真实宽高比展示，CSS columns 瀑布流，不裁切 */
export function QrWorldGalleryCard({
  template,
  onSelect,
}: {
  template: QrTemplate;
  onSelect: () => void;
}) {
  const { ref, visible } = useIntersectionVisible<HTMLButtonElement>();
  const thumbUrl = template.thumbnailUrl?.trim();
  const showTitle = Boolean(template.title?.trim());
  const hint = readThumbHint(template);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  const onImgLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNatural({ width: img.naturalWidth, height: img.naturalHeight });
    }
  }, []);

  const aspectStyle =
    natural != null
      ? { aspectRatio: `${natural.width} / ${natural.height}` as const }
      : hint != null
        ? { aspectRatio: `${hint.width} / ${hint.height}` as const }
        : undefined;

  return (
    <button
      type="button"
      ref={ref}
      onClick={onSelect}
      className="group block w-full overflow-hidden rounded-xl bg-[#141820] text-left ring-1 ring-white/[0.08] transition hover:ring-white/20"
    >
      <div className="relative w-full bg-zinc-900 leading-none">
        {!visible || !thumbUrl ? (
          <div
            className="qr-skeleton w-full"
            style={aspectStyle ?? { minHeight: 120 }}
            aria-hidden
          />
        ) : (
          <>
            {!natural ? (
              <div
                className="qr-skeleton absolute inset-0 w-full"
                style={aspectStyle ?? { minHeight: 120 }}
                aria-hidden
              />
            ) : null}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbUrl}
              alt={template.title}
              loading="lazy"
              decoding="async"
              width={hint?.width}
              height={hint?.height}
              onLoad={onImgLoad}
              className="relative z-[1] block w-full max-w-full align-top transition duration-300 group-hover:scale-[1.01]"
              style={{ height: "auto" }}
            />
          </>
        )}
      </div>
      {showTitle ? (
        <p className="truncate px-2.5 py-2 text-xs font-medium text-white/90">{template.title}</p>
      ) : null}
    </button>
  );
}
