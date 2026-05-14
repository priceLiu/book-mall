"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import {
  type VisualLabGalleryItem,
  loadVisualLabGallery,
  persistVisualLabGallery,
  removeVisualLabGalleryItem,
} from "@/lib/visual-lab-gallery";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

function kindLabel(it: VisualLabGalleryItem): string {
  switch (it.kind) {
    case "reply-image":
      return "回复图片";
    case "reply-video":
      return "回复视频";
    default:
      return "快照";
  }
}

export function VisualLabGalleryClient() {
  const [items, setItems] = useState<VisualLabGalleryItem[]>([]);

  const refresh = useCallback(() => {
    setItems(loadVisualLabGallery());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onRemove = (id: string) => {
    setItems(removeVisualLabGalleryItem(id));
  };

  const onClear = () => {
    persistVisualLabGallery([]);
    setItems([]);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-12 pt-8 sm:px-6">
      <div>
        <h1 className="vl-h1">成果展</h1>
        <p className="vl-muted mt-1 text-sm">
          与分析室保存的内容同步（仅当前浏览器、本站点）。快照最多{" "}
          <span className="tabular-nums">24</span> 条；从模型回复保存的图片 / 视频分别最多{" "}
          <span className="tabular-nums">20</span> / <span className="tabular-nums">10</span>{" "}
          条。删除或清空后立即生效。
        </p>
        <p className="tw-muted mt-2 text-sm">
          <ToolImplementationCrossLink href="/visual-lab/implementation" />
        </p>
      </div>

      {items.length > 0 ? (
        <div className="mt-6 flex justify-end">
          <button type="button" className="vl-btn vl-btn-ghost vl-btn-sm vl-text-danger" onClick={onClear}>
            清空全部
          </button>
        </div>
      ) : null}

      {items.length === 0 ? (
        <div className="vl-note mt-10 max-w-lg">
          <p className="text-sm">
            还没有保存任何内容。可在分析室上传图片后点击「保存到成果展」，或在模型回复中的图片 /
            视频旁点击「存入成果」。
          </p>
          <Link href="/visual-lab/analysis" className="vl-btn vl-btn-primary mt-4 inline-flex">
            打开分析室
          </Link>
        </div>
      ) : (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="vl-gallery-card">
              <div className="vl-gallery-thumb-bg">
                {it.kind === "reply-video" && it.sourceUrl ? (
                  <video
                    src={it.sourceUrl}
                    className="vl-gallery-video-preview"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <Image
                    src={it.thumbDataUrl}
                    alt={it.imageName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                )}
              </div>
              <div className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-[var(--vl-border-strong)] bg-[var(--vl-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--vl-muted)]">
                    {kindLabel(it)}
                  </span>
                </div>
                <div className="line-clamp-2 font-medium leading-snug text-[var(--vl-fg)]">{it.imageName}</div>
                <div className="vl-muted text-xs">{formatTime(it.createdAt)}</div>
                {it.kind !== "reply-video" ? (
                  <div className="vl-muted text-xs">
                    {it.stats.width}×{it.stats.height} · {it.stats.aspectLabel} · 亮度{" "}
                    {it.stats.brightness.toFixed(2)}
                  </div>
                ) : null}
                {it.note ? (
                  <p className="line-clamp-4 text-xs leading-relaxed text-[var(--vl-muted)]">{it.note}</p>
                ) : null}
                <button
                  type="button"
                  className="vl-btn vl-btn-outline vl-btn-sm w-full"
                  onClick={() => onRemove(it.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
