"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ToolShellCloseButton } from "@/components/ui/tool-shell-close-button";
import styles from "@/app/fitting-room/ai-fit/closet/closet.module.css";
import { cn } from "@/lib/utils";

type MockVideoItem = {
  id: string;
  posterUrl: string;
  prompt: string;
  createdAt: string;
  durationLabel: string;
  resolution: string;
};

const LONG_PROMPT =
  "广角镜头，电影级镜头。热气球正在高空飞行。镜头缓慢向猫咪推进。猫咪的毛发被风吹得剧烈飘动，它转头看了一下周围的风景。背景的绿色山丘和云层向后移动，产生强烈的空间纵深感。光影斑驳变化，高帧率，吉卜力画风。";

const MOCK_ITEMS: MockVideoItem[] = [
  {
    id: "v1",
    posterUrl: "/images/1.jpeg",
    prompt: LONG_PROMPT,
    createdAt: "2026-05-13T10:44:24.000Z",
    durationLabel: "5秒",
    resolution: "1080P",
  },
  {
    id: "v2",
    posterUrl: "/images/2.jpeg",
    prompt:
      "慢推镜头，逆光。城市天台上的风掠过发丝，远处霓虹渐次亮起，浅景深，电影感调色，4K 质感。",
    createdAt: "2026-05-12T16:20:00.000Z",
    durationLabel: "5秒",
    resolution: "720P",
  },
  {
    id: "v3",
    posterUrl: "/images/3.jpeg",
    prompt: "航拍缓慢下降，海岸线与浪花，金色时刻，水平稳像，纪录片风格。",
    createdAt: "2026-05-11T09:10:00.000Z",
    durationLabel: "8秒",
    resolution: "1080P",
  },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
}

function promptEllipsis(text: string, max = 40): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export function ImageToVideoLibraryClient() {
  const [items] = useState<MockVideoItem[]>(MOCK_ITEMS);
  const [preview, setPreview] = useState<MockVideoItem | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [preview]);

  const lightbox =
    mounted &&
    preview &&
    createPortal(
      <div
        className={styles.lightbox}
        role="dialog"
        aria-modal="true"
        aria-label="视频预览"
        onClick={() => setPreview(null)}
      >
        <div
          className={styles.lightboxInner}
          onClick={(e) => e.stopPropagation()}
        >
          <ToolShellCloseButton
            floating
            label="关闭"
            onClick={() => setPreview(null)}
          />
          <div className="flex max-h-[85vh] max-w-3xl flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.posterUrl}
                alt=""
                className="h-full w-full object-contain"
              />
              <p className="absolute bottom-2 left-0 right-0 text-center text-xs text-white/70">
                演示：成片后此处播放视频
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{preview.prompt}</p>
          </div>
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={cn(styles.workspace, "image-to-video-library")}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>我的视频库</h1>
          <p className={styles.subtitle}>
            所有内容均由人工智能模型生成，准确性和完整性无法保证。（当前为示例数据）
          </p>
        </div>
        <Link href="/image-to-video/lab" className={styles.cta}>
          <span aria-hidden>✨</span>
          去实验室生成
        </Link>
      </header>

      <section className={styles.container}>
        <div className={styles.grid}>
          {items.map((item) => (
            <article key={item.id} className={styles.card}>
              <button
                type="button"
                className={styles.thumbButton}
                onClick={() => setPreview(item)}
                aria-label="预览"
              >
                <div
                  className={cn(styles.thumbWrap, "!aspect-video max-h-[200px]")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.posterUrl}
                    alt=""
                    className={styles.thumb}
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                    {item.durationLabel} · {item.resolution}
                  </div>
                </div>
              </button>
              <div className={styles.cardBodyLibrary}>
                <div className={styles.cardMetaLibrary}>
                  <span className={styles.cardPromptLibrary}>
                    {promptEllipsis(item.prompt)}
                  </span>
                  <span className={styles.cardTime}>{formatDate(item.createdAt)}</span>
                </div>
                <div className={styles.cardActionsLibrary}>
                  <button
                    type="button"
                    className={styles.btnPreview}
                    onClick={() => setPreview(item)}
                  >
                    预览
                  </button>
                  <button type="button" className={styles.btnDownload} disabled>
                    下载
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
      {lightbox}
    </div>
  );
}
