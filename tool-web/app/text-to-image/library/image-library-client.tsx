"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ToolImplementationCrossLink } from "@/components/tool-implementation-crosslink";
import { ToolShellCloseButton } from "@/components/ui/tool-shell-close-button";
import { MessagesLocaleProvider, useMessagesLocale } from "@/components/messages-locale-context";
import type { TextToImageLibraryItem } from "@/lib/text-to-image-library-types";
import styles from "@/app/fitting-room/ai-fit/closet/closet.module.css";

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

function downloadFilenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "image.png";
    return seg.split("?")[0] || "image.png";
  } catch {
    return "image.png";
  }
}

function promptEllipsis(text: string, max = 42): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

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

type PromptTooltipState = {
  itemId: string;
  text: string;
  left: number;
  top: number;
  maxWidth: number;
};

function LibraryView() {
  const { t } = useMessagesLocale();
  const [items, setItems] = useState<TextToImageLibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [promptTip, setPromptTip] = useState<PromptTooltipState | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/text-to-image/library", { cache: "no-store" });
        const data = (await r.json()) as {
          items?: TextToImageLibraryItem[];
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok) {
          setError(data.error ?? null);
          setItems([]);
        } else {
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      } catch {
        if (!cancelled) {
          setError(null);
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!previewUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewUrl(null);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [previewUrl]);

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
      if (!window.confirm(t("closetDeleteConfirm"))) return;
      setBusyId(id);
      try {
        const r = await fetch(
          `/api/text-to-image/library?id=${encodeURIComponent(id)}`,
          { method: "DELETE" },
        );
        if (!r.ok) {
          setError(t("closetDeleteFailed"));
          return;
        }
        setItems((prev) => prev.filter((x) => x.id !== id));
      } catch {
        setError(t("closetDeleteFailed"));
      } finally {
        setBusyId(null);
      }
    },
    [t],
  );

  const promptTooltipPortal =
    mounted &&
    promptTip &&
    createPortal(
      <div
        id="image-library-prompt-tooltip"
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
    previewUrl &&
    createPortal(
      <div
        className={styles.lightbox}
        role="dialog"
        aria-modal="true"
        aria-label={t("closetLightboxAria")}
        onClick={() => setPreviewUrl(null)}
      >
        <div
          className={styles.lightboxInner}
          onClick={(e) => e.stopPropagation()}
        >
          <ToolShellCloseButton
            floating
            label={t("closetLightboxClose")}
            onClick={() => setPreviewUrl(null)}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt=""
            className={styles.lightboxImg}
            referrerPolicy="no-referrer"
          />
        </div>
      </div>,
      document.body,
    );

  return (
    <div className={styles.workspace}>
      <header className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>{t("imageLibraryPageTitle")}</h1>
          <p className={styles.subtitle}>{t("disclaimer")}</p>
          <ToolImplementationCrossLink href="/text-to-image/implementation" />
        </div>
        <Link href="/text-to-image" className={styles.cta}>
          <span aria-hidden>✨</span>
          {t("imageLibraryGoGenerate")}
        </Link>
      </header>

      <section className={styles.container}>
        {error ? <p className={styles.banner}>{error}</p> : null}

        {loading ? (
          <div className={styles.loading}>{t("imageLibraryLoading")}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{t("imageLibraryEmptyTitle")}</p>
            <p className={styles.emptyHint}>{t("imageLibraryEmptyHint")}</p>
          </div>
        ) : (
          <div className={styles.grid}>
            {items.map((item) => (
              <article key={item.id} className={styles.card}>
                <button
                  type="button"
                  className={styles.thumbButton}
                  onClick={() => setPreviewUrl(item.imageUrl)}
                  aria-label={t("closetCardPreview")}
                >
                  <div className={styles.thumbWrap}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt=""
                      className={styles.thumb}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                </button>
                <div className={styles.cardBodyLibrary}>
                  <div className={styles.cardMetaLibrary}>
                    <span
                      className={styles.cardPromptLibrary}
                      tabIndex={item.prompt?.trim() ? 0 : undefined}
                      aria-describedby={
                        promptTip?.itemId === item.id
                          ? "image-library-prompt-tooltip"
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
                      onFocus={(e) => {
                        const full = item.prompt?.trim();
                        if (!full) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        setPromptTip({
                          itemId: item.id,
                          text: full,
                          ...computePromptTooltipPlacement(rect),
                        });
                      }}
                    >
                      {item.prompt?.trim()
                        ? promptEllipsis(item.prompt)
                        : t("imageLibraryPromptNone")}
                    </span>
                    <span className={styles.cardTime}>{formatDate(item.createdAt)}</span>
                  </div>
                  <div className={styles.cardActionsLibrary}>
                    <button
                      type="button"
                      className={styles.btnPreview}
                      onClick={() => setPreviewUrl(item.imageUrl)}
                    >
                      {t("closetCardPreview")}
                    </button>
                    <a
                      className={styles.btnDownload}
                      href={item.imageUrl}
                      download={downloadFilenameFromUrl(item.imageUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t("closetCardDownload")}
                    </a>
                    <button
                      type="button"
                      className={styles.btnDelete}
                      onClick={() => handleDelete(item.id)}
                      disabled={busyId === item.id}
                    >
                      {t("closetCardDelete")}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {promptTooltipPortal}
      {lightbox}
    </div>
  );
}

export function TextToImageLibraryClient() {
  return (
    <MessagesLocaleProvider>
      <LibraryView />
    </MessagesLocaleProvider>
  );
}
