import type { JianyingFrameInput } from "@/lib/canvas/canvas-jianying-export";
import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
import type { SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";
import type { MediaTimelineV1 } from "@/lib/media/timeline-types";

/** 画布剪映导出帧 → Timeline v1 */
export function fromCanvasJianyingFrames(
  frames: JianyingFrameInput[],
): MediaTimelineV1 {
  const sorted = [...frames].sort((a, b) => a.frameIndex - b.frameIndex);
  const clips = sorted
    .filter((f) => Boolean(f.videoUrl?.trim()))
    .map((f, i) => ({
      order: i,
      videoUrl: f.videoUrl!.trim(),
      audioUrl: f.audioUrl?.trim() || undefined,
      subtitle: f.dialogue?.trim() || undefined,
      durationSec:
        f.durationSec && f.durationSec > 0 ? f.durationSec : undefined,
    }));
  return { version: 1, clips };
}

/** 电商分镜表 → Timeline v1 */
export function fromEcomStoryboardSheet(
  sheet: StoryboardSheet,
  opts?: { panelIndexes?: number[] },
): MediaTimelineV1 {
  const indexFilter =
    opts?.panelIndexes && opts.panelIndexes.length > 0
      ? new Set(opts.panelIndexes)
      : null;
  const panels = sheet.panels
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter((p) => !indexFilter || indexFilter.has(p.index));
  const clips = panels
    .filter((p) => Boolean(p.videoUrl?.trim() && /^https?:\/\//.test(p.videoUrl!.trim())))
    .map((p, i) => ({
      order: i,
      videoUrl: p.videoUrl!.trim(),
      subtitle: p.dialogue?.trim() || undefined,
      durationSec:
        p.durationHintSec && p.durationHintSec > 0
          ? p.durationHintSec
          : undefined,
    }));
  return { version: 1, clips };
}

/** 种草视频逐镜 → Timeline v1 */
export function fromEcomSeedVideoPlan(shots: SeedVideoShot[]): MediaTimelineV1 {
  const sorted = shots.slice().sort((a, b) => a.index - b.index);
  const clips = sorted
    .filter((s) => Boolean(s.videoUrl?.trim() && /^https?:\/\//.test(s.videoUrl!.trim())))
    .map((s, i) => ({
      order: i,
      videoUrl: s.videoUrl!.trim(),
      audioUrl: s.ttsUrl?.trim() || undefined,
      subtitle: s.voiceover?.trim() || undefined,
      durationSec: s.durationSec > 0 ? s.durationSec : undefined,
    }));
  return { version: 1, clips };
}
