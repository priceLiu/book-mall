"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { MessagesLocaleProvider, useMessagesLocale } from "@/components/messages-locale-context";
import type { AiFitClosetItem } from "@/lib/ai-fit-closet-types";
import styles from "./closet.module.css";

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
    const seg = u.pathname.split("/").filter(Boolean).pop() ?? "tryon.jpg";
    return seg.split("?")[0] || "tryon.jpg";
  } catch {
    return "tryon.jpg";
  }
}

function ClosetView() {
  const { t } = useMessagesLocale();
  const [items, setItems] = useState<AiFitClosetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/ai-fit/closet", { cache: "no-store" });
        const data = (await r.json()) as {
          items?: AiFitClosetItem[];
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

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm(t("closetDeleteConfirm"))) return;
      setBusyId(id);
      try {
        const r = await fetch(
          `/api/ai-fit/closet?id=${encodeURIComponent(id)}`,
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
          <button
            type="button"
            className={styles.lightboxClose}
            onClick={() => setPreviewUrl(null)}
            aria-label={t("closetLightboxClose")}
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- 外链 OSS */}
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
          <h1 className={styles.title}>{t("closetPageTitle")}</h1>
          <p className={styles.subtitle}>{t("disclaimer")}</p>
        </div>
        <Link href="/fitting-room/ai-fit" className={styles.cta}>
          <span aria-hidden>✨</span>
          {t("closetGoTryOn")}
        </Link>
      </header>

      <section className={styles.container}>
        {error ? <p className={styles.banner}>{error}</p> : null}

        {loading ? (
          <div className={styles.loading}>{t("closetLoading")}</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>{t("closetEmptyTitle")}</p>
            <p className={styles.emptyHint}>{t("closetEmptyHint")}</p>
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
                <div className={styles.cardBody}>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardMode}>
                      {item.garmentMode === "two_piece"
                        ? t("closetCardModeTwo")
                        : t("closetCardModeOne")}
                    </span>
                    <span className={styles.cardTime}>
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                  <div className={styles.cardActions}>
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
      {lightbox}
    </div>
  );
}

export function AiFitClosetClient() {
  return (
    <MessagesLocaleProvider>
      <ClosetView />
    </MessagesLocaleProvider>
  );
}
