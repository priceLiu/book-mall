import { useEffect, useState } from "react";

import { cropNormalizedBboxPreview } from "@/lib/normalized-bbox-crop";
import { buildEcomOssThumbUrl } from "@/lib/ecom-oss-image-url";
import { cn } from "@/lib/utils";

type Props = {
  url: string;
  bbox: [number, number, number, number];
  alt?: string;
  className?: string;
  /** fill：填满父级（顶栏缩略图）；aspect：按裁切图比例（悬停预览，不拉伸） */
  fit?: "fill" | "aspect";
};

export function NormalizedBboxCropImg({
  url,
  bbox,
  alt = "",
  className,
  fit = "fill",
}: Props) {
  const [cropUrl, setCropUrl] = useState<string | null>(null);
  const fallback = buildEcomOssThumbUrl(url);
  const referrer =
    fallback.startsWith("blob:") || fallback.startsWith("data:") ? undefined : "no-referrer";

  useEffect(() => {
    let cancelled = false;
    void cropNormalizedBboxPreview(url, bbox)
      .then((next) => {
        if (!cancelled) setCropUrl(next);
      })
      .catch(() => {
        if (!cancelled) setCropUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [bbox, url]);

  const src = cropUrl ?? fallback;

  return (
    <span className={cn("relative block overflow-hidden bg-[#f5f5f7]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        referrerPolicy={referrer}
        className={
          cropUrl
            ? fit === "aspect"
              ? "block h-auto max-h-full w-full object-contain"
              : "h-full w-full object-cover"
            : "h-full w-full object-cover opacity-40"
        }
      />
    </span>
  );
}
