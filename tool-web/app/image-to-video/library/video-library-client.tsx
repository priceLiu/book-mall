"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ToolShellCloseButton } from "@/components/ui/tool-shell-close-button";
import type {
  ImageToVideoLibraryItem,
  ToolLibraryQuota,
} from "@/lib/image-to-video-library-types";
import styles from "@/app/fitting-room/ai-fit/closet/closet.module.css";
import {
  confirmDestructiveTwice,
  CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
} from "@/lib/confirm-destructive-twice";
import { cn } from "@/lib/utils";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";

const RETENTION_DAYS = 7;

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

function promptEllipsis(text: string, max = 42): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type PromptTooltipState = {
  itemId: string;
  text: string;
  left: number;
  top: number;
  maxWidth: number;
};

function computePromptTooltipPlacement(rect: DOMRect): Pick<
  PromptTooltipState,
  "left" | "top" | "maxWidth"
> {
  const margin = 8;
  const maxWidth = Math.min(400, window.innerWidth - margin * 2);
  const left = Math.min(
    Math.max(margin, rect.left),
    window.innerWidth - margin - maxWidth,
  );
  const below = rect.bottom + 6;
  const estimatedMaxH = Math.min(window.innerHeight * 0.42, 300);
  let top = below;
  if (below + estimatedMaxH > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - estimatedMaxH - 6);
  }
  return { left, top, maxWidth };
}

function modeZh(mode: string): string {
  if (mode === "i2v") return "图生";
  if (mode === "ref") return "参考";
  if (mode === "t2v") return "文生";
  return mode;
}

export function ImageToVideoLibraryClient() {
  const [items, setItems] = useState<ImageToVideoLibraryItem[]>([]);
  const [quota, setQuota] = useState<ToolLibraryQuota | null>(null);
  const [preview, setPreview] = useState<ImageToVideoLibraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [promptTip, setPromptTip] = useState<PromptTooltipState | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const r = await fetch("/api/image-to-video/library", { cache: "no-store" });
      const data = (await r.json()) as {
        items?: ImageToVideoLibraryItem[];
        quota?: ToolLibraryQuota;
        error?: string;
      };
      if (!r.ok) {
        setError(data.error ?? "加载失败");
        setItems([]);
        setQuota(null);
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setQuota(
        data.quota && typeof data.quota.used === "number" && typeof data.quota.max === "number"
          ? data.quota
          : null,
      );
    } catch {
      setError("网络错误");
      setItems([]);
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  useEffect(() => {
    if (!promptTip) return;
    const hide = () => setPromptTip(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [promptTip]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (
        !confirmDestructiveTwice(
          "从「我的视频库」删除本条？将从列表移除并尝试删除云端 OSS 中的对应视频文件。",
          CONFIRM_DELETE_LIBRARY_OSS_SECOND_ZH,
        )
      )
        return;
      setBusyId(id);
      try {
        const r = await fetch(`/api/image-to-video/library?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!r.ok) {
          setError("删除失败");
          return;
        }
        setItems((prev) => prev.filter((x) => x.id !== id));
        setQuota((q) =>
          q ? { ...q, used: Math.max(0, q.used - 1) } : q,
        );
      } catch {
        setError("删除失败");
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  const quotaHint = useMemo(() => {
    if (!quota) return null;
    const nearFull = quota.used >= quota.max;
    return (
      <p
        className={cn(
          "my-0 rounded-lg border px-3 py-2 text-[0.8rem] leading-relaxed",
          nearFull
            ? "border-amber-500/50 bg-amber-500/10 text-amber-950 dark:text-amber-50"
            : "border-border/80 bg-muted/40 text-muted-foreground",
        )}
      >
        <span className="font-medium text-foreground">
          已用 {quota.used} / {quota.max} 条视频
        </span>
        。默认每人最多 {quota.max} 条；为控制存储成本，建议每条保留约 {RETENTION_DAYS}{" "}
        天，到期后管理员可按需清理，重要内容请下载备份。
        <button
          type="button"
          className="ml-1 font-medium text-violet-700 underline decoration-violet-600/40 underline-offset-2 dark:text-violet-300"
          onClick={() =>
            alert(
              "视频库扩容为付费增值服务，即将开放自助申请。如需洽谈企业套餐，请通过网站联系方式或客服渠道联络。",
            )
          }
        >
          申请扩容（即将支持）
        </button>
      </p>
    );
  }, [quota]);

  const promptTooltipPortal =
    mounted &&
    promptTip &&
    createPortal(
      <div
        id="video-library-prompt-tooltip"
        role="tooltip"
        className={styles.promptFullTooltip}
        style={{
          position: "fixed",
          left: promptTip.left,
          top: promptTip.top,
          maxWidth: promptTip.maxWidth,
          zIndex: 10050,
        }}
      >
        {promptTip.text}
      </div>,
      document.body,
    );

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
          <div className="flex max-h-[85vh] w-full max-w-4xl flex-col gap-3">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
              <video
                src={preview.videoUrl}
                controls
                playsInline
                className="h-full w-full object-contain"
                preload="metadata"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {preview.modelLabel ? `${preview.modelLabel} · ` : null}
              {modeZh(preview.mode)} · {preview.durationSec}秒 · {preview.resolution}
              {preview.seed ? ` · seed ${preview.seed}` : null}
            </p>
            <p className="text-xs leading-relaxed text-foreground/90">{preview.prompt ?? "（无提示词）"}</p>
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
            所有内容均由人工智能模型生成。保存入库的视频会转存到自有 OSS；模型原始链接约 24 小时有效。
            建议保留约 {RETENTION_DAYS} 天，管理员可按存储策略删除库中文件。
          </p>
          <ToolImplementationCrossLink href="/image-to-video/implementation" />
        </div>
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
          <Link href="/image-to-video/lab" className={styles.cta}>
            <span aria-hidden>✨</span>
            去实验室生成
          </Link>
        </div>
      </header>

      <section className={styles.container}>
        {quotaHint}
        {error ? <p className={styles.banner}>{error}</p> : null}
        {loading ? (
          <div className={styles.loading}>加载中…</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>暂无已保存的视频</p>
            <p className={styles.emptyHint}>
              在图生视频实验室生成成片后，点击卡片上的「保存」写入此处（会占用配额并显示保留说明）。
            </p>
          </div>
        ) : (
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
                    <video
                      src={item.videoUrl}
                      muted
                      playsInline
                      className={cn(styles.thumb, "!object-cover")}
                      preload="metadata"
                    />
                    <div className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.65rem] font-medium text-white">
                      {item.durationSec}秒 · {item.resolution}
                    </div>
                  </div>
                </button>
                <div className={styles.cardBodyLibrary}>
                  <div className={styles.cardMetaLibrary}>
                    <span className="text-[0.68rem] text-muted-foreground">
                      {modeZh(item.mode)}
                      {item.modelLabel ? ` · ${item.modelLabel}` : ""}
                    </span>
                    <span
                      className={styles.cardPromptLibrary}
                      tabIndex={item.prompt?.trim() ? 0 : undefined}
                      aria-describedby={
                        promptTip?.itemId === item.id
                          ? "video-library-prompt-tooltip"
                          : undefined
                      }
                      onMouseEnter={(e) => {
                        const full = item.prompt?.trim();
                        if (!full) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPromptTip({
                          itemId: item.id,
                          text: full,
                          ...computePromptTooltipPlacement(rect),
                        });
                      }}
                      onMouseLeave={() => setPromptTip(null)}
                      onBlur={() => setPromptTip(null)}
                    >
                      {item.prompt?.trim() ? promptEllipsis(item.prompt) : "（无提示词）"}
                    </span>
                    <span className="text-[0.65rem] text-muted-foreground">
                      建议保留至 {formatDate(item.retainUntil)}
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
                    <a
                      className={styles.btnDownload}
                      href={item.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      下载
                    </a>
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => void handleDelete(item.id)}
                      disabled={busyId === item.id}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {lightbox}
      {promptTooltipPortal}
    </div>
  );
}
