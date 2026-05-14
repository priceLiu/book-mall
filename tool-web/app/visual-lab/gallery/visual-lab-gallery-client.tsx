"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Trash2, X } from "lucide-react";
import { AnalysisReplyMarkdown } from "@/components/visual-lab/analysis-reply-markdown";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import {
  type VisualLabGalleryItem,
  VISUAL_LAB_GALLERY_SNAPSHOT_MAX,
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
    case "reply-markdown":
      return "文本/代码";
    default:
      return "快照";
  }
}

function isHttpUrl(s: string | undefined): boolean {
  if (!s || !s.trim()) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function VisualLabGalleryClient() {
  const [items, setItems] = useState<VisualLabGalleryItem[]>([]);
  const [detail, setDetail] = useState<VisualLabGalleryItem | null>(null);

  const refresh = useCallback(() => {
    setItems(loadVisualLabGallery());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!detail) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail]);

  const onRemove = (id: string) => {
    setItems(removeVisualLabGalleryItem(id));
    setDetail((d) => (d?.id === id ? null : d));
  };

  const onClear = () => {
    persistVisualLabGallery([]);
    setItems([]);
    setDetail(null);
  };

  return (
    <div className="mx-auto max-w-[1100px] px-4 pb-12 pt-8 sm:px-6">
      <div>
        <h1 className="vl-h1">成果展</h1>
        <p className="vl-muted mt-1 text-sm">
          与分析室保存的内容同步（仅当前浏览器、本站点）。分析快照与「仅保存模型回复」（含代码）合计最多{" "}
          <span className="tabular-nums">{VISUAL_LAB_GALLERY_SNAPSHOT_MAX}</span> 条，
          <strong className="font-medium text-zinc-200">再保存时会删掉最早的一条以实现固定条数</strong>。
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
            视频旁点击「存入成果」；若无附件，也可在收到回复后点「保存到成果展」保存整段 Markdown。
          </p>
          <Link href="/visual-lab/analysis" className="vl-btn vl-btn-primary mt-4 inline-flex">
            打开分析室
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <li key={it.id} className="vl-gallery-card">
              <button
                type="button"
                className="vl-gallery-card-media-btn"
                onClick={() => setDetail(it)}
                aria-label={`查看「${it.imageName}」详情`}
              >
                <div className="vl-gallery-thumb-bg vl-gallery-thumb-bg--reflect">
                  {it.kind === "reply-video" && it.sourceUrl ? (
                    <video
                      src={it.sourceUrl}
                      className="vl-gallery-video-preview"
                      muted
                      playsInline
                      preload="metadata"
                    />
                  ) : (
                    <Image
                      src={it.thumbDataUrl}
                      alt=""
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  )}
                  <span className="vl-gallery-eye-overlay" aria-hidden>
                    <Eye className="h-7 w-7 text-white drop-shadow-md" strokeWidth={2} />
                    <span className="vl-gallery-eye-caption">查看回复</span>
                  </span>
                </div>
              </button>
              <div className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-[var(--vl-border-strong)] bg-[var(--vl-surface-2)] px-2 py-0.5 text-xs font-medium text-[var(--vl-muted)]">
                    {kindLabel(it)}
                  </span>
                  {it.replyMarkdown ? (
                    <span className="text-xs font-medium text-[var(--vl-success-hint)]">含正文</span>
                  ) : (
                    <span className="text-xs text-[var(--vl-muted)]">无正文</span>
                  )}
                </div>
                <div className="line-clamp-2 font-medium leading-snug text-[var(--vl-fg)]">{it.imageName}</div>
                <div className="vl-muted text-xs">{formatTime(it.createdAt)}</div>
                {it.kind !== "reply-video" && it.kind !== "reply-markdown" ? (
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
      ) : null}

      {detail ? (
        <div
          className="vl-gallery-detail-backdrop"
          role="presentation"
          onClick={() => setDetail(null)}
        >
          <div
            className="vl-gallery-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vl-gallery-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="vl-gallery-detail-header">
              <h2 id="vl-gallery-detail-title" className="vl-gallery-detail-title">
                {detail.imageName}
              </h2>
              <button
                type="button"
                className="vl-gallery-detail-close"
                aria-label="关闭"
                onClick={() => setDetail(null)}
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </button>
            </header>
            <div className="vl-gallery-detail-body">
              <div className="vl-gallery-detail-asset">
                <h3 className="vl-gallery-detail-section-title">原素材</h3>
                {detail.kind === "reply-markdown" ? (
                  <p className="vl-muted text-sm leading-relaxed">
                    本条为从分析室一键保存的<strong className="text-[var(--vl-fg)]">纯回复</strong>
                    （Markdown，可含代码），无单独图片或视频素材。右侧为完整正文，可使用代码块的预览与运行。
                  </p>
                ) : detail.kind === "reply-video" && detail.sourceUrl ? (
                  <video
                    src={detail.sourceUrl}
                    className="vl-gallery-detail-video"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : isHttpUrl(detail.sourceUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- external reply URL
                  <img
                    src={detail.sourceUrl!}
                    alt={detail.imageName}
                    className="vl-gallery-detail-img"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL thumb
                  <img
                    src={detail.thumbDataUrl}
                    alt={detail.imageName}
                    className="vl-gallery-detail-img"
                  />
                )}
                {isHttpUrl(detail.sourceUrl) ? (
                  <a
                    href={detail.sourceUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vl-inline-link vl-gallery-detail-open-tab mt-2 inline-block text-xs"
                  >
                    新标签打开原链
                  </a>
                ) : null}
                <p className="vl-muted mt-3 text-xs leading-relaxed">{detail.note}</p>
              </div>
              <div className="vl-gallery-detail-reply">
                <h3 className="vl-gallery-detail-section-title">模型回复（无思考过程）</h3>
                {detail.replyMarkdown && detail.replyMarkdown.trim() ? (
                  <div className="vl-gallery-detail-markdown">
                    <AnalysisReplyMarkdown markdown={detail.replyMarkdown} showReplyExportToolbars={false} />
                  </div>
                ) : (
                  <p className="vl-muted text-sm leading-relaxed">
                    本条为旧数据或未附带保存时的正文。请继续在分析室对话后重新「存入成果」以带上回复内容。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
