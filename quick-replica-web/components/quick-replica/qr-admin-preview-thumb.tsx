"use client";

import { resolveQrTemplatePreviewMedia } from "@/lib/qr-template-preview-media";
import type { QrTemplate } from "@/lib/qr-template-types";

type Props = {
  thumbnailUrl: string;
  mediaType: "image" | "video" | "audio";
  reference?: QrTemplate["reference"];
  output?: QrTemplate["output"];
  className?: string;
};

export function QrAdminPreviewThumb({
  thumbnailUrl,
  mediaType,
  reference,
  output,
  className = "h-16 w-12",
}: Props) {
  const preview = resolveQrTemplatePreviewMedia({
    thumbnailUrl,
    mediaType,
    outputUrl: output?.url,
    referenceVideoUrl: reference?.slots.referenceVideo?.url,
  });

  return (
    <div className={`overflow-hidden rounded bg-black/30 ${className}`}>
      {!preview ? (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-[var(--qr-text-muted)]">
          —
        </div>
      ) : preview.kind === "video" ? (
        <video
          src={preview.url}
          poster={preview.poster}
          className="h-full w-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
    </div>
  );
}
