"use client";

import { Eye } from "lucide-react";
import { useState } from "react";

import { QrFullscreenImagePreview } from "@/components/quick-replica/qr-fullscreen-image-preview";

const EYE_BTN =
  "pointer-events-auto inline-flex items-center justify-center rounded-full border border-white/20 bg-black/55 text-white/90 shadow-lg backdrop-blur-sm transition hover:bg-black/75 hover:scale-[1.03]";

/** 悬停出现预览 Eye；点击打开全屏自适应大图（对齐画布图片节点） */
export function QrHoverEyeOverlay({
  src,
  title,
  size = "md",
}: {
  src: string;
  title?: string;
  size?: "sm" | "md" | "lg";
}) {
  const [open, setOpen] = useState(false);
  const btn =
    size === "lg"
      ? `${EYE_BTN} size-[4.5rem]`
      : size === "sm"
        ? `${EYE_BTN} size-8`
        : `${EYE_BTN} size-9`;
  const icon = size === "lg" ? "size-8" : size === "sm" ? "size-3.5" : "size-4";

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center opacity-0 transition group-hover/media:opacity-100 group-hover:opacity-100">
        <button
          type="button"
          title="预览大图"
          aria-label="预览大图"
          className={btn}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Eye className={`${icon} pointer-events-none`} strokeWidth={1.75} />
        </button>
      </div>
      {open ? (
        <QrFullscreenImagePreview
          src={src}
          title={title}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
