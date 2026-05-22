"use client";

import { useEffect, useState } from "react";
import type { LandingShowcase } from "@/lib/landing-showcase";
import { useBookMallBaseUrl } from "@/components/book-mall-base-url-provider";
import { StorySpaceHome } from "@/components/landing/story-space-home";
import { fetchStorySpaceBySlug, type StorySpaceData } from "@/lib/story-api";

export function StorySpacePublicClient({
  slug,
  showcase,
}: {
  slug: string;
  showcase: LandingShowcase;
}) {
  const base = useBookMallBaseUrl();
  const [space, setSpace] = useState<StorySpaceData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base) return;
    void fetchStorySpaceBySlug(base, slug)
      .then(setSpace)
      .catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, [base, slug]);

  if (error) {
    return (
      <div className="story-container py-24 text-center text-[var(--story-muted)]">
        无法加载该空间（未发布或不存在）。
      </div>
    );
  }

  if (!space) {
    return (
      <div className="story-container py-24 text-center text-[var(--story-muted)]">
        加载中…
      </div>
    );
  }

  return <StorySpaceHome space={space} showcase={showcase} />;
}
