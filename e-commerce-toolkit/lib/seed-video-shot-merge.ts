import type { SeedVideoShot } from "@/lib/seed-video-types";

/** 合并远端/本地镜头：优先保留已生成的 video / tts / taskId */
export function mergeSeedVideoShots(
  local: SeedVideoShot[],
  remote: SeedVideoShot[],
): SeedVideoShot[] {
  if (remote.length === 0) return local;
  const localByIndex = new Map(local.map((s) => [s.index, s]));
  return remote.map((rs) => {
    const ls = localByIndex.get(rs.index);
    return {
      ...rs,
      videoUrl: rs.videoUrl?.trim() || ls?.videoUrl,
      ttsUrl: rs.ttsUrl?.trim() || ls?.ttsUrl,
      videoTaskId: rs.videoTaskId?.trim() || ls?.videoTaskId,
    };
  });
}
