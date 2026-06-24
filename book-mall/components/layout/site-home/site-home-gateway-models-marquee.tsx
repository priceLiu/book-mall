"use client";

import Link from "next/link";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";

import type { MarketShowcaseItem } from "@/lib/gateway/market-catalog";

const ROLE_BADGE: Record<string, string> = {
  LLM: "LLM",
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
};

function marketModelHref(gatewayOrigin: string, canonicalKey: string): string {
  const encoded = canonicalKey
    .split("/")
    .map((s) => encodeURIComponent(s))
    .join("/");
  return `${gatewayOrigin}/dashboard/market/${encoded}`;
}

function ModelCard({
  model,
  gatewayOrigin,
}: {
  model: MarketShowcaseItem;
  gatewayOrigin: string;
}) {
  const href = marketModelHref(gatewayOrigin, model.canonicalKey);
  const roleLabel = ROLE_BADGE[model.role] ?? model.role;

  return (
    <Link
      href={href}
      className="site-home-model-card group flex w-[220px] shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-foreground/20 hover:shadow-md sm:w-[240px]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={model.coverUrl}
          alt={model.displayName}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
          {roleLabel}
        </span>
      </div>
      <div className="space-y-1.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2">
            {model.displayName}
          </h3>
          {model.creditsPerUnit != null ? (
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {model.creditsPerUnit} 积分/次
            </span>
          ) : null}
        </div>
        {model.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {model.description}
          </p>
        ) : null}
        {model.vendorLabel ? (
          <p className="text-[10px] text-muted-foreground/80">{model.vendorLabel}</p>
        ) : null}
      </div>
    </Link>
  );
}

type Props = {
  models: MarketShowcaseItem[];
  gatewayOrigin: string;
};

export function SiteHomeGatewayModelsMarquee({ models, gatewayOrigin }: Props) {
  if (models.length === 0) return null;

  return (
    <div className="site-home-models-track">
      <Marquee
        className="site-home-models-marquee gap-4 sm:gap-5"
        innerClassName="gap-4 sm:gap-5"
        fade
        pauseOnHover
      >
        {models.map((model) => (
          <ModelCard key={model.canonicalKey} model={model} gatewayOrigin={gatewayOrigin} />
        ))}
      </Marquee>
    </div>
  );
}
