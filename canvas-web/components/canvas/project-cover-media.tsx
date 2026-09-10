"use client";

import { useEffect, useState } from "react";
import { isProjectThumbnailVideoUrl } from "@/lib/canvas/project-thumbnail";
import { cn } from "@/lib/utils";

/** 列表 / 封面槽：铺满容器、居中裁剪，无留白边 */
export const PROJECT_COVER_MEDIA_FILL_CLASS =
  "block size-full object-cover object-center";

function CoverPlaceholder({
  placeholderLetter,
  hint,
}: {
  placeholderLetter?: string;
  hint?: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[var(--canvas-accent)]/10 to-[var(--canvas-surface-2)] text-[var(--canvas-muted)]">
      <span className="text-3xl font-light text-white/25">
        {placeholderLetter?.slice(0, 1) || "画"}
      </span>
      <span className="mt-1 text-[10px] text-white/30">{hint}</span>
    </div>
  );
}

/** 画布列表 / 历史记录封面：支持图片与视频，加载失败时显示占位而非浏览器坏图图标 */
export function ProjectCoverMedia({
  url,
  alt,
  className = PROJECT_COVER_MEDIA_FILL_CLASS,
  placeholderLetter,
  eager = false,
}: {
  url?: string;
  alt: string;
  className?: string;
  /** 无封面或加载失败时显示的首字 */
  placeholderLetter?: string;
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [url]);

  if (!url?.trim() || failed) {
    return (
      <CoverPlaceholder
        placeholderLetter={placeholderLetter}
        hint={url && failed ? "封面已失效" : "等待出图"}
      />
    );
  }

  if (isProjectThumbnailVideoUrl(url)) {
    return (
      <div className="relative size-full">
        {!loaded ? (
          <CoverPlaceholder placeholderLetter={placeholderLetter} hint="加载封面…" />
        ) : null}
        <video
          src={url}
          className={cn(className, !loaded && "opacity-0")}
          muted
          playsInline
          preload={eager ? "auto" : "metadata"}
          onLoadedData={() => setLoaded(true)}
          onError={() => setFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className="relative size-full">
      {!loaded ? (
        <CoverPlaceholder placeholderLetter={placeholderLetter} hint="加载封面…" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={cn(className, "transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
