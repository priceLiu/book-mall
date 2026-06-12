import type { JianyingFrameInput } from "@/lib/canvas/canvas-jianying-export";
import type { StoryboardSheet } from "@/lib/ecom/ecom-storyboard-types";
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
export function fromEcomStoryboardSheet(sheet: StoryboardSheet): MediaTimelineV1 {
  const panels = sheet.panels.slice().sort((a, b) => a.index - b.index);
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
