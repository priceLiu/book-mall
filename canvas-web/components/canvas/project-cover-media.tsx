"use client";

import { useState } from "react";
import { isProjectThumbnailVideoUrl } from "@/lib/canvas/project-thumbnail";

/** 列表 / 封面槽：铺满容器、居中裁剪，无留白边 */
export const PROJECT_COVER_MEDIA_FILL_CLASS =
  "block size-full object-cover object-center";

/** 画布列表 / 历史记录封面：支持图片与视频，加载失败时显示占位而非浏览器坏图图标 */
export function ProjectCoverMedia({
  url,
  alt,
  className = PROJECT_COVER_MEDIA_FILL_CLASS,
  placeholderLetter,
}: {
  url?: string;
  alt: string;
  className?: string;
  /** 无封面或加载失败时显示的首字 */
  placeholderLetter?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!url?.trim() || failed) {
    return (
      <div className="flex size-full flex-col items-center justify-center bg-gradient-to-br from-[var(--canvas-accent)]/10 to-[var(--canvas-surface-2)] text-[var(--canvas-muted)]">
        <span className="text-3xl font-light text-white/25">
          {placeholderLetter?.slice(0, 1) || "画"}
        </span>
        <span className="mt-1 text-[10px] text-white/30">
          {url && failed ? "封面已失效" : "等待出图"}
        </span>
      </div>
    );
  }

  if (isProjectThumbnailVideoUrl(url)) {
    return (
      <video
        src={url}
        className={className}
        muted
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
