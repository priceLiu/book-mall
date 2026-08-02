"use client";

import { useEffect, useState } from "react";
import {
  buildHomeCategoryCards,
  QR_HOME_CARD_CATEGORIES,
  type QrHomeCategoryCard,
} from "@/lib/qr-home-feed";
import type { QrTemplate } from "@/lib/qr-template-types";
import { QrHomeHeroPanel } from "@/components/quick-replica/qr-home-hero-panel";

type Props = {
  onCategoryClick?: () => void;
};

/** 公开落地页 · 首页四宫格（builtin 模板作背景） */
export function QrLandingHome({ onCategoryClick }: Props) {
  const [cards, setCards] = useState<QrHomeCategoryCard[]>(() =>
    buildHomeCategoryCards({}),
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const results = await Promise.all(
          QR_HOME_CARD_CATEGORIES.map(async (category) => {
            const res = await fetch(
              `/api/templates?category=${encodeURIComponent(category)}`,
            );
            if (!res.ok) return [] as QrTemplate[];
            const data = (await res.json()) as { templates?: QrTemplate[] };
            return data.templates ?? [];
          }),
        );
        if (cancelled) return;
        const byCategory = Object.fromEntries(
          QR_HOME_CARD_CATEGORIES.map((cat, index) => [cat, results[index] ?? []]),
        ) as Partial<Record<(typeof QR_HOME_CARD_CATEGORIES)[number], QrTemplate[]>>;
        setCards(buildHomeCategoryCards(byCategory));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QrHomeHeroPanel
      variant="landing"
      cards={cards}
      loading={loading}
      onCategoryClick={() => {
        if (onCategoryClick) {
          onCategoryClick();
          return;
        }
        window.location.href = "/register";
      }}
    />
  );
}
