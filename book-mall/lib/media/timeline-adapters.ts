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
      // 合并时由 ffprobe 取实际成片时长，勿用 durationHintSec（脚本预估常短于 Gateway 成片）
    }));
  return { version: 1, clips };
}

/** 种草视频逐镜 → Timeline v1 */
export function fromEcomSeedVideoPlan(
  shots: SeedVideoShot[],
  opts?: { shotIndexes?: number[] },
): MediaTimelineV1 {
  const indexFilter =
    opts?.shotIndexes && opts.shotIndexes.length > 0
      ? new Set(opts.shotIndexes)
      : null;
  const sorted = shots
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter((s) => !indexFilter || indexFilter.has(s.index));
  const clips = sorted
    .filter((s) => Boolean(s.videoUrl?.trim() && /^https?:\/\//.test(s.videoUrl!.trim())))
    .map((s, i) => ({
      order: i,
      videoUrl: s.videoUrl!.trim(),
      audioUrl: s.ttsUrl?.trim() || undefined,
      subtitle: s.voiceover?.trim() || undefined,
    }));
  return { version: 1, clips };
}

/** 穿搭视频分镜 → Timeline v1（无口播/TTS） */
export function fromOutfitVideoScenes(
  scenes: Array<{ index: number; videoUrl?: string; durationSec?: number }>,
  opts?: { sceneIndexes?: number[] },
): MediaTimelineV1 {
  const indexFilter =
    opts?.sceneIndexes && opts.sceneIndexes.length > 0
      ? new Set(opts.sceneIndexes)
      : null;
  const sorted = scenes
    .slice()
    .sort((a, b) => a.index - b.index)
    .filter((s) => !indexFilter || indexFilter.has(s.index));
  const clips = sorted
    .filter((s) => Boolean(s.videoUrl?.trim() && /^https?:\/\//.test(s.videoUrl!.trim())))
    .map((s, i) => ({
      order: i,
      videoUrl: s.videoUrl!.trim(),
      durationSec:
        typeof s.durationSec === "number" && s.durationSec > 0 ? s.durationSec : undefined,
    }));
  return { version: 1, clips };
}
