import type { SeedVideoShot } from "@/lib/ecom/ecom-seed-video-types";

/** 合并镜头表：incoming 覆盖文案/参数，保留已生成的 video / tts / taskId */
export function mergeSeedVideoShotsPreserveMedia(
  incoming: SeedVideoShot[],
  previous: SeedVideoShot[],
): SeedVideoShot[] {
  if (incoming.length === 0) return previous;
  const prevByIndex = new Map(previous.map((s) => [s.index, s]));
  return incoming.map((s) => {
    const prev = prevByIndex.get(s.index);
    if (!prev) return s;
    return {
      ...prev,
      ...s,
      videoUrl: s.videoUrl?.trim() || prev.videoUrl,
      ttsUrl: s.ttsUrl?.trim() || prev.ttsUrl,
      videoTaskId: s.videoTaskId?.trim() || prev.videoTaskId,
    };
  });
}
