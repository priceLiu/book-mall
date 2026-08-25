import type { SeedVideoShot } from "@/lib/seed-video-types";

/** 从远端同步到本地：文案以远端为准，保留本地已生成的 video / tts / taskId */
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

/** 持久化 / 拉取后合并：以本地编辑为准，保留远端已生成的 video / tts / taskId */
export function mergeSeedVideoShotsForPersist(
  local: SeedVideoShot[],
  remote: SeedVideoShot[],
): SeedVideoShot[] {
  if (local.length === 0) return remote;
  const remoteByIndex = new Map(remote.map((s) => [s.index, s]));
  return local.map((ls) => {
    const rs = remoteByIndex.get(ls.index);
    if (!rs) return ls;
    return {
      ...ls,
      videoUrl: rs.videoUrl?.trim() || ls.videoUrl,
      ttsUrl: rs.ttsUrl?.trim() || ls.ttsUrl,
      videoTaskId: rs.videoTaskId?.trim() || ls.videoTaskId,
    };
  });
}
