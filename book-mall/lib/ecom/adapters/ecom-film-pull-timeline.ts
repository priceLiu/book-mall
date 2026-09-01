import type { FilmPullProductionPlan, FilmPullRenderPlan } from "@/lib/ecom/ecom-film-pull-types";
import type { MediaTimelineV1 } from "@/lib/media/timeline-types";

export function fromEcomFilmPullPlan(plan: FilmPullRenderPlan): MediaTimelineV1 {
  const sorted = plan.shots.slice().sort((a, b) => a.shotNo - b.shotNo);
  const clips = sorted
    .filter((s) => Boolean(s.videoUrl?.trim() && /^https?:\/\//.test(s.videoUrl.trim())))
    .map((s, i) => ({
      order: i,
      videoUrl: s.videoUrl!.trim(),
      subtitle: s.voiceover?.trim() || undefined,
      durationSec: s.durationSec > 0 ? s.durationSec : undefined,
    }));
  return { version: 1, clips };
}

export function fromEcomFilmPullProductionPlan(plan: FilmPullProductionPlan): MediaTimelineV1 {
  const sorted = plan.shots.slice().sort((a, b) => a.shotNo - b.shotNo);
  const clips = sorted
    .filter((s) => Boolean(s.videoUrl?.trim() && /^https?:\/\//.test(s.videoUrl!.trim())))
    .map((s, i) => ({
      order: i,
      videoUrl: s.videoUrl!.trim(),
      subtitle: s.voiceover?.trim() || undefined,
      durationSec: s.durationSec > 0 ? s.durationSec : undefined,
    }));
  return { version: 1, clips };
}
