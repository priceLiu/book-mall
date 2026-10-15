"use client";

import { Eye } from "lucide-react";
import { useState } from "react";

import { QrFrostIconButton } from "@/components/quick-replica/qr-frost-icon-button";
import { QrFullscreenImagePreview } from "@/components/quick-replica/qr-fullscreen-image-preview";

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

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[3] flex items-center justify-center opacity-0 transition group-hover/media:opacity-100 group-hover:opacity-100">
        <QrFrostIconButton
          size={size}
          title="预览大图"
          aria-label="预览大图"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
        >
          <Eye strokeWidth={1.75} />
        </QrFrostIconButton>
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
