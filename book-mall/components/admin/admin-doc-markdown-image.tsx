"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { FullscreenImagePreview } from "@/components/media/fullscreen-image-preview";

export function AdminDocMarkdownImage({
  src,
  alt,
}: {
  src: string;
  alt: string;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="mb-4 h-auto max-w-full cursor-zoom-in rounded-lg border border-[#d0d7de] bg-white"
        loading="lazy"
        title="双击全屏查看"
        onDoubleClick={() => setFullscreen(true)}
      />
      {mounted && fullscreen
        ? createPortal(
            <FullscreenImagePreview
              src={src}
              title={alt || undefined}
              onClose={() => setFullscreen(false)}
            />,
            document.body,
          )
        : null}
    </>
  );
}
