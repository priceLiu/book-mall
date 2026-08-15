import {
  SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
  type SeedVideoDirectPlan,
  type SeedVideoPlan,
  type SeedVideoSettings,
  type SeedVideoShot,
} from "@/lib/seed-video-types";

/** 从逐镜脚本表合成方案①式单次成片参数（脚本 + 参考图 → 一条 ≤30s 视频） */
export function buildSeedVideoDirectPlanFromShots(
  shots: SeedVideoShot[],
  opts?: {
    settings?: SeedVideoSettings;
    stylePack?: SeedVideoPlan["stylePack"];
    existing?: Partial<SeedVideoDirectPlan>;
  },
): SeedVideoDirectPlan | null {
  const sorted = [...shots].sort((a, b) => a.index - b.index);
  if (sorted.length < 1) return null;

  const shotSequence = sorted.map((s) => ({
    index: s.index,
    timeSlice: s.timeSlice,
    refImageLabel: s.refImageLabel,
    sceneDescription: s.sceneDescription,
    voiceover: s.voiceover,
    durationSec: s.durationSec,
  }));

  const promptLines = sorted.map((s) => {
    const body = s.videoPrompt?.trim() || s.sceneDescription?.trim();
    if (!body) return "";
    return `镜${s.index} ${s.timeSlice} 参考${s.refImageLabel}：${body}`;
  });

  const globalPrompt =
    opts?.existing?.globalPrompt?.trim() ||
    promptLines.filter(Boolean).join("\n");
  const fullVoiceover =
    opts?.existing?.fullVoiceover?.trim() ||
    sorted
      .map((s) => s.voiceover?.trim())
      .filter(Boolean)
      .join(" ");

  if (!globalPrompt && !fullVoiceover) return null;

  const summed = sorted.reduce((sum, s) => sum + (s.durationSec || 0), 0);
  const durationSec = Math.min(
    SEED_VIDEO_DIRECT_MAX_DURATION_SEC,
    Math.max(
      3,
      opts?.existing?.durationSec ??
        opts?.settings?.targetDurationSec ??
        (summed > 0 ? summed : SEED_VIDEO_DIRECT_MAX_DURATION_SEC),
    ),
  );

  return {
    globalPrompt: globalPrompt || fullVoiceover,
    fullVoiceover,
    aspectRatio:
      opts?.existing?.aspectRatio ?? opts?.settings?.aspectRatio ?? "9:16",
    durationSec,
    shotSequence,
    voiceTone: opts?.existing?.voiceTone ?? opts?.stylePack?.voicePreset,
    bgmPreset: opts?.existing?.bgmPreset ?? opts?.stylePack?.bgmPreset,
    materialUsage: opts?.existing?.materialUsage,
    generatedVideos: opts?.existing?.generatedVideos,
    videoUrl: opts?.existing?.videoUrl,
    taskId: opts?.existing?.taskId,
  };
}
