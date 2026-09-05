"use client";

import Link from "next/link";
import { ECOM_HOME_FEATURED_CARDS } from "@/lib/ecom-home-feed";

const CARD_GRADIENTS = [
  "linear-gradient(135deg, rgba(0,113,227,0.28) 0%, rgba(15,23,42,0.92) 60%)",
  "linear-gradient(135deg, rgba(168,85,247,0.25) 0%, rgba(15,23,42,0.92) 60%)",
  "linear-gradient(135deg, rgba(34,197,94,0.22) 0%, rgba(15,23,42,0.92) 60%)",
  "linear-gradient(135deg, rgba(251,146,60,0.22) 0%, rgba(15,23,42,0.92) 60%)",
] as const;

/** 公开落地页 · 首页四宫格 */
export function EcomLandingHome() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-16 px-4 py-10 sm:gap-20 sm:px-6 sm:py-12">
        <section className="flex flex-col items-center gap-6 text-center sm:gap-8">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            <span className="text-[var(--ecom-primary)]">电商工具箱</span>
            <span className="mt-2 block text-3xl font-semibold text-white/95 sm:text-4xl md:text-5xl">
              主图 · 详情 · 带货视频
            </span>
          </h1>
          <p className="max-w-2xl text-base text-white/60 sm:text-lg">
            浏览功能无需登录；开始生成主图、详情或成片时再登录即可。
          </p>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {ECOM_HOME_FEATURED_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.id}
                href={card.href}
                className="group relative flex min-h-[168px] flex-col justify-end overflow-hidden rounded-[20px] border border-white/10 p-5 text-left transition hover:border-[var(--ecom-primary)]/45 hover:shadow-[0_0_24px_rgba(0,113,227,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ecom-primary)]/60"
              >
                <div
                  className="absolute inset-0"
                  style={{ background: CARD_GRADIENTS[index % CARD_GRADIENTS.length] }}
                />
                <div className="relative z-10 flex flex-col gap-2">
                  <Icon
                    className="h-6 w-6 text-[var(--ecom-primary)] transition group-hover:scale-105"
                    strokeWidth={1.75}
                  />
                  <p className="truncate text-base font-semibold text-white">
                    {card.title}
                  </p>
                  <p className="line-clamp-2 text-sm text-white/65">
                    {card.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </div>
  );
}
