"use client";

import Image from "next/image";
import type { HotComicCover } from "@/lib/landing-showcase";

type HotComicsCarouselProps = {
  covers: HotComicCover[];
};

function CoverCard({ cover }: { cover: HotComicCover }) {
  return (
    <figure className="group relative w-[140px] shrink-0 sm:w-[168px] md:w-[192px]">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl border border-white/10 bg-[var(--story-surface)] shadow-lg shadow-black/40 transition duration-300 group-hover:border-white/25 group-hover:shadow-black/60">
        <Image
          src={cover.src}
          alt={cover.title}
          fill
          sizes="(max-width: 640px) 140px, 192px"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-3 pt-10">
          <figcaption className="story-sans truncate text-xs font-medium text-white sm:text-sm">
            {cover.title}
          </figcaption>
        </div>
      </div>
    </figure>
  );
}

export function HotComicsCarousel({ covers }: HotComicsCarouselProps) {
  if (covers.length === 0) return null;

  const track = (
    <div className="flex items-stretch gap-4 sm:gap-5">
      {covers.map((cover) => (
        <CoverCard key={cover.id} cover={cover} />
      ))}
    </div>
  );

  return (
    <section className="mt-14 sm:mt-20">
      <div className="story-container mb-8 flex flex-col gap-2 sm:mb-10">
        <p className="twenty-eyebrow">Hot Comics</p>
        <h2 className="story-serif text-2xl text-white sm:text-3xl">热门漫剧</h2>
        <p className="twenty-body max-w-2xl">
          来自 story-web 创作者们的竖屏漫剧封面——用 AI 搭建、在你自己的空间里发布。
        </p>
      </div>

      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-[var(--story-bg)] to-transparent sm:w-20" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[var(--story-bg)] to-transparent sm:w-20" />
        <div className="hot-comics-marquee-track flex w-max gap-4 sm:gap-5">
          {track}
          {track}
        </div>
      </div>
    </section>
  );
}
