"use client";

import { useMemo, useState } from "react";
import { useFittingRoomLocale } from "@/components/fitting-room-locale-context";
import type { Outfit } from "@/lib/fitting-room-types";
import { OUTFITS } from "@/lib/fitting-room-data";
import { fittingRoomImageSrc } from "@/lib/fitting-room-image-url";
import { FITTING_ROOM_IMG_FALLBACK } from "@/lib/fitting-room-fallback-image";
import { fittingRoomRemotePlaceholderSrc } from "@/lib/fitting-room-remote-placeholder";
import { FittingRoomModal } from "./fitting-room-modal";
import type { SexFilterValue } from "./fitting-room-toolbar";
import styles from "./fitting-room.module.css";

export function FittingRoomGallery({ sexFilter }: { sexFilter: SexFilterValue }) {
  const { t } = useFittingRoomLocale();
  const [selected, setSelected] = useState<Outfit | null>(null);

  const filtered = useMemo(
    () => OUTFITS.filter((o) => sexFilter === "all" || o.sex === sexFilter),
    [sexFilter],
  );

  return (
    <section className={styles.gallerySection}>
      <h2 className={styles.galleryTitle}>{t("galleryTitle")}</h2>
      {OUTFITS.length === 0 ? (
        <p className="tw-muted" role="status">
          {t("galleryNoData")}
        </p>
      ) : filtered.length === 0 ? (
        <p className="tw-muted" role="status">
          {t("galleryEmpty")}
        </p>
      ) : (
        <div className={styles.grid}>
          {filtered.map((outfit) => (
            <button
              key={outfit.id}
              type="button"
              className={styles.card}
              onClick={() => setSelected(outfit)}
            >
              <span className={styles.cardImgWrap}>
                <img
                  src={fittingRoomImageSrc(outfit.url)}
                  alt={t("outfitCardAlt")}
                  className={styles.cardImg}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    const el = e.currentTarget;
                    const step = el.dataset.frbStep ?? "";
                    if (step === "") {
                      el.dataset.frbStep = "remote";
                      el.src = fittingRoomRemotePlaceholderSrc(outfit.id);
                      return;
                    }
                    if (step === "remote") {
                      el.dataset.frbStep = "svg";
                      el.src = FITTING_ROOM_IMG_FALLBACK;
                    }
                  }}
                />
              </span>
            </button>
          ))}
        </div>
      )}
      {selected ? (
        <FittingRoomModal outfit={selected} onClose={() => setSelected(null)} />
      ) : null}
    </section>
  );
}
