import type { ComposeWorkbenchClip } from "@private/platform-compose-ui/types";

import type {
  JianyingLibtvAudioClipSlot,
  JianyingLibtvClipSlot,
} from "@/lib/canvas/jianying-from-workspace";

/** 全屏左侧「连线资产」：上游视频 / 封面图 / TTS 音频（非仅本地 import） */
export function buildJianyingUpstreamComposeLibraryClips(
  clipSlots: JianyingLibtvClipSlot[],
  audioClipSlots: JianyingLibtvAudioClipSlot[],
  orderNodeIds?: readonly string[],
  audioOrderNodeIds?: readonly string[],
): ComposeWorkbenchClip[] {
  const out: ComposeWorkbenchClip[] = [];

  for (const s of clipSlots) {
    const video = s.videoUrl?.trim();
    const poster = s.posterUrl?.trim();
    if (video) {
      out.push({
        id: `upstream-video-${s.sourceNodeId}`,
        videoUrl: video,
        posterUrl: poster,
        label: s.label?.trim() || `视频 ${s.sequence}`,
        subtitle: s.dialogue?.trim(),
        source: "external",
      });
      continue;
    }
    if (poster) {
      out.push({
        id: `upstream-image-${s.sourceNodeId}`,
        videoUrl: poster,
        posterUrl: poster,
        label: s.label?.trim() || `参考图 ${s.sequence}`,
        source: "external",
      });
    }
  }

  for (const a of audioClipSlots) {
    const audio = a.audioUrl?.trim() || a.previewUrl?.trim();
    if (!audio) continue;
    const audioIndex = audioOrderNodeIds?.indexOf(a.sourceNodeId) ?? -1;
    const pairedTimelineClipId =
      audioIndex >= 0 && orderNodeIds?.[audioIndex]
        ? orderNodeIds[audioIndex]
        : undefined;
    out.push({
      id: `upstream-audio-${a.sourceNodeId}`,
      videoUrl: "",
      posterUrl: undefined,
      audioUrl: audio,
      label: a.label?.trim() || `配音 ${a.sequence}`,
      pairedTimelineClipId,
      source: "external",
    });
  }

  return out;
}
