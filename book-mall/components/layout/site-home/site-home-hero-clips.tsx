"use client";

import { SiteHomeHeroClip } from "./site-home-hero-clip";

export function SiteHomeHeroClips({ sources }: { sources: string[] }) {
  if (!sources.length) return null;
  return (
    <div className="site-home-hero-clips" aria-label="社区漫剧片段预览">
      {sources.map((src) => (
        <SiteHomeHeroClip key={src} src={src} />
      ))}
    </div>
  );
}
