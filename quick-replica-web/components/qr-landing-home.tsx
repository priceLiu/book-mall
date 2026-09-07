"use client";

import { useEffect, useState } from "react";
import { qrReEnterHref } from "@/lib/portal-auth-links";
import {
  buildHomeCategoryCards,
  QR_HOME_CARD_CATEGORIES,
  type QrHomeCardCategory,
  type QrHomeCategoryCard,
} from "@/lib/qr-home-feed";
import type { QrTemplate } from "@/lib/qr-template-types";
import { QrHomeHeroPanel } from "@/components/quick-replica/qr-home-hero-panel";

function homeCategoryRedirectPath(category: QrHomeCardCategory): string {
  return `/?category=${encodeURIComponent(category)}`;
}

type Props = {
  onCategoryClick?: (category: QrHomeCardCategory) => void;
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
        const res = await fetch("/api/templates?homeFeed=1");
        if (cancelled) return;
        if (!res.ok) {
          setCards(buildHomeCategoryCards({}));
          return;
        }
        const data = (await res.json()) as {
          templatesByCategory?: Partial<Record<QrHomeCardCategory, QrTemplate[]>>;
        };
        setCards(buildHomeCategoryCards(data.templatesByCategory ?? {}));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const enterCategory = (category: QrHomeCardCategory) => {
    if (onCategoryClick) {
      onCategoryClick(category);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/tools-session/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as { active?: boolean };
          if (data.active) {
            window.location.assign(homeCategoryRedirectPath(category));
            return;
          }
        }
      } catch {
        /* 无 token 或续签失败，走 SSO */
      }
      window.location.href = qrReEnterHref(homeCategoryRedirectPath(category));
    })();
  };

  return (
    <QrHomeHeroPanel
      variant="landing"
      cards={cards}
      loading={loading}
      onCategoryClick={enterCategory}
    />
  );
}

export function isQrHomeCardCategory(value: string): value is QrHomeCardCategory {
  return (QR_HOME_CARD_CATEGORIES as readonly string[]).includes(value);
}
