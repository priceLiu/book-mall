"use client";

import type { StoryHeroClip } from "@/lib/story-theater-videos";
import { SiteHomeHeroClip } from "./site-home-hero-clip";

export function SiteHomeHeroClips({ clips = [] }: { clips?: StoryHeroClip[] }) {
  if (!clips.length) return null;
  return (
    <div className="site-home-hero-clips" aria-label="社区漫剧片段预览">
      {clips.map((clip, index) => (
        <SiteHomeHeroClip
          key={clip.url}
          src={clip.url}
          poster={clip.poster}
          eagerPoster={index < 3}
        />
      ))}
    </div>
  );
}
