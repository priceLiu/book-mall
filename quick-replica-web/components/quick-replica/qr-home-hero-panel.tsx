"use client";

import { ImageIcon, RefreshCw, Smile, Video, Volume2 } from "lucide-react";
import clsx from "clsx";
import type { QrHomeCategoryCard, QrHomeCardCategory } from "@/lib/qr-home-feed";

const CARD_ICONS = {
  video: Video,
  image: ImageIcon,
  character: Smile,
  audio: Volume2,
} as const;

type Props = {
  cards: QrHomeCategoryCard[];
  loading?: boolean;
  onCategoryClick: (category: QrHomeCardCategory) => void;
  variant?: "landing" | "app";
  onRefresh?: () => void;
};

function CategoryCardBackground({ urls }: { urls: string[] }) {
  if (urls.length === 0) {
    return (
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(59,130,246,0.22) 0%, rgba(30,41,59,0.85) 55%, rgba(15,23,42,0.95) 100%)",
        }}
      />
    );
  }

  if (urls.length === 1) {
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={urls[0]}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1419]/92 via-[#0f1419]/45 to-[#0f1419]/20" />
      </>
    );
  }

  return (
    <>
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-px bg-black/30">
        {urls.slice(0, 4).map((url, index) => (
          <div key={`${url}-${index}`} className="relative min-h-0 min-w-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-[#0f1419]/94 via-[#0f1419]/52 to-[#0f1419]/18" />
    </>
  );
}

function CategoryCard({
  card,
  onClick,
}: {
  card: QrHomeCategoryCard;
  onClick: () => void;
}) {
  const Icon = CARD_ICONS[card.id];

  return (
    <button
      type="button"
      onClick={onClick}
      className="qr-home-category-card group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[20px] border border-[var(--qr-border)] p-5 text-left transition hover:border-[var(--qr-brand)]/45 hover:shadow-[var(--qr-shadow-brand)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--qr-brand)]/60"
    >
      <CategoryCardBackground urls={card.backgroundUrls} />
      <div className="relative z-10 flex flex-col gap-2">
        <Icon
          className="h-6 w-6 transition group-hover:scale-105"
          style={{ color: "var(--qr-brand)" }}
          strokeWidth={1.75}
        />
        <p className="truncate text-base font-semibold text-[var(--qr-text-primary)]">
          {card.title}
        </p>
        <p className="truncate text-sm text-[var(--qr-text-secondary)]">
          {card.description}
        </p>
      </div>
    </button>
  );
}

/** 首页 Hero + 四宫格（作品图作卡片背景） */
export function QrHomeHeroPanel({
  cards,
  loading = false,
  onCategoryClick,
  variant = "app",
  onRefresh,
}: Props) {
  const isLanding = variant === "landing";

  return (
    <div
      className={clsx(
        "flex min-h-0 flex-1 flex-col",
        isLanding ? "w-full" : "overflow-y-auto qr-scroll-panel",
      )}
    >
      <div
        className={clsx(
          "mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-4 sm:gap-14 sm:px-6 lg:gap-20",
          isLanding ? "pt-8 pb-[18vh] sm:pt-10 sm:pb-[22vh]" : "pt-6 pb-[16vh] sm:pt-10 sm:pb-[20vh]",
        )}
      >
        <section className="flex flex-col items-center gap-6 text-center sm:gap-10 lg:gap-16">
          <h1
            className={clsx(
              "max-w-full font-bold leading-[1.15] tracking-tight text-balance",
              /* 随视口流体缩放，避免固定 text-8xl/9xl 在窄屏溢出 */
              isLanding
                ? "text-[clamp(1.75rem,0.9rem+5.2vw,5.75rem)]"
                : "text-[clamp(1.5rem,0.85rem+4.6vw,4.75rem)]",
            )}
          >
            <span style={{ color: "var(--qr-brand)" }}>一键复刻</span>
            喜欢的同款作品
          </h1>
          <p className="w-full max-w-4xl px-1 text-sm text-[var(--qr-text-muted)] sm:text-lg lg:text-xl">
            选择喜欢的作品, 点击复制, 选择模型, 即可复刻.
          </p>
        </section>

        <section className="flex flex-col gap-4">
          {onRefresh ? (
            <div className="flex justify-end">
              <button
                type="button"
                title="换一批背景"
                disabled={loading}
                onClick={onRefresh}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-[var(--qr-border)] px-2.5 text-xs text-[var(--qr-text-muted)] transition hover:bg-white/5 hover:text-[var(--qr-text-primary)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                换一批
              </button>
            </div>
          ) : null}

          <div
            className={clsx(
              "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4",
              loading && cards.every((c) => c.backgroundUrls.length === 0)
                ? "opacity-70"
                : undefined,
            )}
          >
            {cards.map((card) => (
              <CategoryCard
                key={card.id}
                card={card}
                onClick={() => onCategoryClick(card.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
