import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { HotComicsCarousel } from "@/components/landing/twenty/hot-comics-carousel";
import { DiscoverMoreVideos } from "@/components/landing/twenty/discover-more-videos";
import { TwentyFooter } from "@/components/landing/twenty/twenty-footer";
import type { LandingShowcase } from "@/lib/landing-showcase";

export type TwentyLandingContent = {
  tagline: string;
  subtitle: string;
  eyebrow?: string;
  showcase: LandingShowcase;
  isOwner?: boolean;
  onPublish?: () => void;
  publishing?: boolean;
  publishError?: string | null;
  publishedProductUrl?: string | null;
};

/**
 * 漫剧空间落地页：Hero + Hot Comics 封面轮播 + Discover More 视频区。
 */
export function TwentyLanding({
  tagline,
  subtitle,
  eyebrow = "story-web · 个人空间",
  showcase,
  isOwner,
  onPublish,
  publishing,
  publishError,
  publishedProductUrl,
}: TwentyLandingContent) {
  return (
    <div className="bg-[var(--story-bg)]">
      <section className="story-container pb-4 pt-10 sm:pb-8 sm:pt-16">
        <p className="twenty-eyebrow text-center">{eyebrow}</p>
        <h1 className="twenty-headline mx-auto mt-8 max-w-4xl text-center">{tagline}</h1>
        <p className="twenty-body mx-auto mt-8 max-w-2xl text-center text-base sm:text-lg">
          {subtitle}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link href="/studio" className="twenty-btn">
            进入创作室
          </Link>
          <Link href="/models" className="twenty-btn-ghost">
            模型配置
          </Link>
          {isOwner && onPublish ? (
            <button
              type="button"
              className="twenty-btn-ghost"
              disabled={publishing}
              onClick={onPublish}
            >
              {publishing ? "发布中…" : "发布到 book-mall"}
            </button>
          ) : null}
        </div>
        {publishError ? (
          <p className="mt-4 text-center text-sm text-red-400">{publishError}</p>
        ) : null}
        {publishedProductUrl ? (
          <p className="mt-4 text-center text-sm text-[var(--story-muted)]">
            已在主站发布：{" "}
            <a
              href={publishedProductUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[var(--story-accent)] hover:underline"
            >
              查看作品页 <ExternalLink className="size-3.5" />
            </a>
          </p>
        ) : null}

        <HotComicsCarousel covers={showcase.covers} />
      </section>

      <DiscoverMoreVideos videos={showcase.videos} />

      <TwentyFooter />
    </div>
  );
}
