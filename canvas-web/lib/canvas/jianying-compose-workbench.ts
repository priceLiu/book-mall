import type { JianyingSnapshotClip } from "@private/platform-compose-ui";

import { audioSlotByNodeId, videoClipSlotByNodeId } from "./jianying-compose-slots";
import type { JianyingLibtvConnectionSnapshot } from "./jianying-from-workspace";

function resolveAudioExportUrl(
  slot: ReturnType<typeof audioSlotByNodeId>,
): string | undefined {
  if (!slot) return undefined;
  const exportUrl = slot.audioUrl?.trim();
  if (slot.hasAudio && exportUrl) return exportUrl;
  const preview = slot.previewUrl?.trim();
  if (preview) return preview;
  return exportUrl || undefined;
}

/** TTS 重生成 · 同 OSS URL 覆盖时仍触发波形/时长刷新 */
function audioMediaKeyForSlot(
  slot: ReturnType<typeof audioSlotByNodeId>,
  resolvedUrl: string,
): string {
  if (!slot) return resolvedUrl;
  return [
    resolvedUrl,
    slot.previewUrl?.trim() ?? "",
    slot.hasAudio ? "1" : "0",
    slot.hasLocalPreview ? "1" : "0",
  ].join("\0");
}

export type JianyingComposeSnapshotClips = {
  videoClips: JianyingSnapshotClip[];
  audioClips: JianyingSnapshotClip[];
};

/** 自动成片 · 视频轨 / 配音轨分离（按连线顺序，不自动配对） */
export function jianyingSnapshotClipsForComposeWorkbench(
  snapshot: JianyingLibtvConnectionSnapshot,
): JianyingComposeSnapshotClips {
  const videoClips: JianyingSnapshotClip[] = [];
  for (const videoNodeId of snapshot.orderNodeIds) {
    const video = videoClipSlotByNodeId(snapshot.clipSlots, videoNodeId);
    if (!video?.hasVideo || !video.videoUrl?.trim()) continue;
    videoClips.push({
      sourceNodeId: videoNodeId,
      videoUrl: video.videoUrl.trim(),
      posterUrl: video.posterUrl,
      label: video.label,
      dialogue: video.dialogue,
    });
  }

  const audioClips: JianyingSnapshotClip[] = [];
  for (const audioNodeId of snapshot.audioOrderNodeIds) {
    const audioSlot = audioSlotByNodeId(snapshot.audioClipSlots, audioNodeId);
    const audioUrl = resolveAudioExportUrl(audioSlot);
    if (!audioUrl) continue;
    audioClips.push({
      sourceNodeId: audioNodeId,
      videoUrl: "",
      label: audioSlot?.label,
      dialogue: audioSlot?.label,
      audioUrl,
      audioMediaKey: audioMediaKeyForSlot(audioSlot, audioUrl),
    });
  }

  return { videoClips, audioClips };
}

export function jianyingPairedUpstreamAudioUrlForVideoNode(
  _snapshot: JianyingLibtvConnectionSnapshot,
  _videoSourceNodeId: string,
): string | undefined {
  return undefined;
}
