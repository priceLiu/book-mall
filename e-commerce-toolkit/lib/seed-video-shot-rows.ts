import type { SeedVideoShot } from "@/lib/seed-video-types";

const DEFAULT_DURATION_SEC = 5;

/** 重排镜号（1…n）与时间片 */
export function reindexSeedVideoShots(shots: SeedVideoShot[]): SeedVideoShot[] {
  let cursor = 0;
  return shots.map((shot, i) => {
    const index = i + 1;
    const durationSec =
      Number.isFinite(shot.durationSec) && shot.durationSec > 0
        ? shot.durationSec
        : DEFAULT_DURATION_SEC;
    const start = cursor;
    const end = start + durationSec;
    cursor = end;
    return {
      ...shot,
      index,
      durationSec,
      timeSlice: `${start}-${end}s`,
    };
  });
}

export function canDeleteSeedVideoShot(
  shot: SeedVideoShot,
  generatingIndices?: ReadonlySet<number>,
): boolean {
  if (generatingIndices?.has(shot.index)) return false;
  if (shot.videoUrl?.trim()) return false;
  return true;
}

/** 在末尾增镜：默认时长，复制上一镜的 @ 引用与 ref 绑定 */
export function appendSeedVideoShot(shots: SeedVideoShot[]): SeedVideoShot[] {
  const prev = shots[shots.length - 1];
  const durationSec = prev?.durationSec ?? DEFAULT_DURATION_SEC;
  const next: SeedVideoShot = {
    index: shots.length + 1,
    timeSlice: "",
    refImageId: prev?.refImageId ?? "",
    refImageLabel: prev?.refImageLabel ?? "",
    sceneDescription: "",
    videoPrompt: prev?.videoPrompt ?? "",
    voiceover: "",
    durationSec,
  };
  return reindexSeedVideoShots([...shots, next]);
}

export function removeSeedVideoShotAt(
  shots: SeedVideoShot[],
  index: number,
): SeedVideoShot[] {
  if (shots.length <= 1) return shots;
  return reindexSeedVideoShots(shots.filter((s) => s.index !== index));
}
