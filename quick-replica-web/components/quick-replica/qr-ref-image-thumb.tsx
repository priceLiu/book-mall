"use client";

import { Download, Eye, X } from "lucide-react";
import { useCallback, useState } from "react";

import { QrModal } from "@/components/quick-replica/qr-modal";
import { downloadImageUrl } from "@/lib/qr-image-upload-paste";

const SIZE_CLASS = {
  sm: "h-[68px] w-[68px]",
  md: "h-24 w-24",
  lg: "h-28 w-28",
} as const;

export type QrRefImageThumbSize = keyof typeof SIZE_CLASS;

type Props = {
  url: string;
  index?: number;
  size?: QrRefImageThumbSize;
  onRemove?: () => void;
  readonly?: boolean;
};

export function QrRefImageThumb({
  url,
  index,
  size = "sm",
  onRemove,
  readonly = false,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const handleDownload = useCallback(
    async (event: React.MouseEvent) => {
      event.stopPropagation();
      await downloadImageUrl(url, `ref-${(index ?? 0) + 1}.jpg`);
    },
    [url, index],
  );

  return (
    <>
      <div
        className={`group relative ${SIZE_CLASS[size]} shrink-0 overflow-hidden rounded-lg bg-zinc-900`}
      >
        <div className="h-full w-full overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>

        {index !== undefined ? (
          <span className="pointer-events-none absolute left-0.5 top-0.5 z-[3] rounded bg-black/60 px-1 py-px text-[9px] text-white">
            {index + 1}
          </span>
        ) : null}

        {onRemove && !readonly ? (
          <button
            type="button"
            className="absolute right-0.5 top-0.5 z-[4] rounded bg-black/60 p-px text-white hover:bg-red-600/80"
            onClick={onRemove}
            aria-label="移除参考图"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}

        <div className="absolute inset-0 z-[2] flex items-center justify-center gap-2.5 bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/70"
            aria-label="预览放大"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxOpen(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/70"
            aria-label="下载图片"
            onClick={(event) => void handleDownload(event)}
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <QrModal
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        variant="square"
        title="图片预览"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="max-h-full max-w-full object-contain" />
        </div>
      </QrModal>
    </>
  );
}
