"use client";

import Link from "next/link";
import { Marquee } from "@devnomic/marquee";
import "@devnomic/marquee/dist/index.css";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { FeaturedShowcaseCard } from "@/lib/site-home/featured-showcase";

function ShowcaseCard({ item }: { item: FeaturedShowcaseCard }) {
  const cover = (
    <div
      className={cn(
        "relative mb-4 w-full shrink-0 overflow-hidden rounded-2xl bg-muted",
        item.coverAspect,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt={item.title}
        className="absolute inset-0 size-full object-cover"
      />
    </div>
  );

  const meta = (
    <div className="shrink-0">
      <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
        {item.categoryLabel}
      </p>
      <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-foreground">
        {item.title}
      </h3>
      {item.summary ? (
        <p className="line-clamp-2 text-sm text-muted-foreground">{item.summary}</p>
      ) : null}
    </div>
  );

  return (
    <div className="site-home-featured-card flex shrink-0 flex-col rounded-xl border border-border bg-card/40 p-4 transition hover:border-border hover:bg-card">
      {item.detailHref ? (
        <Link
          href={item.detailHref}
          className="group flex min-h-0 flex-1 flex-col rounded-lg outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
        >
          {cover}
          {meta}
        </Link>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{cover}{meta}</div>
      )}
      {item.buttonHref && item.buttonLabel ? (
        <Button asChild className="mt-4 w-full shrink-0">
          <Link href={item.buttonHref}>{item.buttonLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}

type Props = {
  items: FeaturedShowcaseCard[];
};

export function SiteHomeFeaturedProductsMarquee({ items }: Props) {
  if (items.length === 0) return null;

  return (
    <div className="site-home-featured-marquee-track">
      <Marquee
        className="site-home-featured-marquee gap-6"
        innerClassName="gap-6"
        fade
        pauseOnHover
      >
        {items.map((item) => (
          <ShowcaseCard key={item.id} item={item} />
        ))}
      </Marquee>
    </div>
  );
}
