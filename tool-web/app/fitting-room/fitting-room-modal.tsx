"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useFittingRoomLocale } from "@/components/fitting-room-locale-context";
import type { Outfit } from "@/lib/fitting-room-types";
import { fittingRoomImageSrc } from "@/lib/fitting-room-image-url";
import { FITTING_ROOM_IMG_FALLBACK } from "@/lib/fitting-room-fallback-image";
import { fittingRoomRemotePlaceholderSrc } from "@/lib/fitting-room-remote-placeholder";
import styles from "./fitting-room.module.css";

function pieceLabel(type: string, t: (k: "pieceTop" | "pieceBottom" | "pieceOther") => string) {
  if (type === "top") return t("pieceTop");
  if (type === "bottom") return t("pieceBottom");
  return t("pieceOther");
}

export function FittingRoomModal({
  outfit,
  onClose,
}: {
  outfit: Outfit;
  onClose: () => void;
}) {
  const { t } = useFittingRoomLocale();
  const slides = outfit.split_images;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [outfit.id]);

  const n = slides.length;
  const safeIndex = n === 0 ? 0 : ((index % n) + n) % n;

  const goPrev = useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i - 1 + n) % n);
  }, [n]);

  const goNext = useCallback(() => {
    if (n <= 1) return;
    setIndex((i) => (i + 1) % n);
  }, [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goPrev, goNext]);

  const purchaseUrl = useMemo(() => {
    const slide = slides[safeIndex];
    return typeof slide?.amazon_url === "string" ? slide.amazon_url.trim() : "";
  }, [slides, safeIndex]);

  const tryOn = useCallback(() => {
    const urls = slides.map((s) => s.url).filter(Boolean);
    console.log("[fitting-room try-on] split image urls:", urls);
  }, [slides]);

  const buy = useCallback(() => {
    if (!purchaseUrl) return;
    window.open(purchaseUrl, "_blank", "noopener,noreferrer");
  }, [purchaseUrl]);

  return (
    <div
      className={styles.modalBackdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.modalPanel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fitting-room-modal-title"
      >
        <button
          type="button"
          className={styles.modalClose}
          aria-label={t("modalCloseAria")}
          onClick={onClose}
        >
          ×
        </button>
        <h2 id="fitting-room-modal-title" className={styles.visuallyHidden}>
          {t("galleryTitle")}
        </h2>

        <div className={styles.carouselWrap}>
          {n > 0 ? (
            <>
              <div className={styles.carouselViewport}>
                <div
                  className={styles.carouselTrack}
                  style={{ transform: `translateX(-${safeIndex * 100}%)` }}
                >
                  {slides.map((slide, slideIdx) => (
                    <div key={slide.id} className={styles.carouselSlide}>
                      <img
                        src={fittingRoomImageSrc(slide.url)}
                        alt={`${t("carouselSlideAlt")} — ${pieceLabel(slide.type, t)}`}
                        className={styles.carouselImg}
                        loading={slideIdx === 0 ? "eager" : "lazy"}
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const el = e.currentTarget;
                          const step = el.dataset.frbStep ?? "";
                          if (step === "") {
                            el.dataset.frbStep = "remote";
                            el.src = fittingRoomRemotePlaceholderSrc(slide.id);
                            return;
                          }
                          if (step === "remote") {
                            el.dataset.frbStep = "svg";
                            el.src = FITTING_ROOM_IMG_FALLBACK;
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              {n > 1 ? (
                <>
                  <button
                    type="button"
                    className={`${styles.carouselNav} ${styles.carouselPrev}`}
                    aria-label={t("carouselPrevAria")}
                    onClick={goPrev}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={`${styles.carouselNav} ${styles.carouselNext}`}
                    aria-label={t("carouselNextAria")}
                    onClick={goNext}
                  >
                    ›
                  </button>
                  <div className={styles.dots}>
                    {slides.map((slide, i) => (
                      <button
                        key={slide.id}
                        type="button"
                        className={`${styles.dot} ${i === safeIndex ? styles.dotActive : ""}`}
                        aria-label={`${i + 1} / ${n}`}
                        aria-current={i === safeIndex}
                        onClick={() => setIndex(i)}
                      />
                    ))}
                  </div>
                </>
              ) : null}
              <p className={styles.slideCaption}>
                {pieceLabel(slides[safeIndex]?.type ?? "", t)}
              </p>
            </>
          ) : (
            <p className={styles.slideCaption}>{t("pieceOther")}</p>
          )}
        </div>

        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.actionPrimary}
            disabled={!purchaseUrl}
            onClick={buy}
          >
            {t("buyOnAmazon")}
          </button>
          <button type="button" className={styles.actionSecondary} onClick={tryOn}>
            {t("tryOn")}
          </button>
        </div>
      </div>
    </div>
  );
}
