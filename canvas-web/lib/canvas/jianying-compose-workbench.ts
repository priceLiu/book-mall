import type { JianyingSnapshotClip } from "@private/platform-compose-ui";

import {
  pairAudioSlotsToVideoOrder,
  type JianyingLibtvConnectionSnapshot,
} from "./jianying-from-workspace";

function resolvePairedAudioExportUrl(
  slot: ReturnType<typeof pairAudioSlotsToVideoOrder>[number],
): string | undefined {
  if (!slot) return undefined;
  const exportUrl = slot.audioUrl?.trim();
  if (slot.hasAudio && exportUrl) return exportUrl;
  const preview = slot.previewUrl?.trim();
  if (preview) return preview;
  return exportUrl || undefined;
}

/** 自动成片 · 按视频顺序对齐上游 TTS（与 export frames 规则一致） */
export function jianyingSnapshotClipsForComposeWorkbench(
  snapshot: JianyingLibtvConnectionSnapshot,
): JianyingSnapshotClip[] {
  const pairedAudio = pairAudioSlotsToVideoOrder(
    snapshot.orderNodeIds,
    snapshot.audioOrderNodeIds,
    snapshot.audioClipSlots,
  );

  return snapshot.clipSlots
    .filter((s) => s.hasVideo && s.videoUrl?.trim())
    .map((s) => {
      const videoIndex = snapshot.orderNodeIds.indexOf(s.sourceNodeId);
      const audioSlot = videoIndex >= 0 ? pairedAudio[videoIndex] : undefined;
      return {
        sourceNodeId: s.sourceNodeId,
        videoUrl: s.videoUrl!.trim(),
        posterUrl: s.posterUrl,
        label: s.label,
        dialogue: s.dialogue,
        audioUrl: resolvePairedAudioExportUrl(audioSlot),
      };
    });
}

export function jianyingPairedUpstreamAudioUrlForVideoNode(
  snapshot: JianyingLibtvConnectionSnapshot,
  videoSourceNodeId: string,
): string | undefined {
  const videoIndex = snapshot.orderNodeIds.indexOf(videoSourceNodeId);
  if (videoIndex < 0) return undefined;
  const paired = pairAudioSlotsToVideoOrder(
    snapshot.orderNodeIds,
    snapshot.audioOrderNodeIds,
    snapshot.audioClipSlots,
  );
  return resolvePairedAudioExportUrl(paired[videoIndex]);
}
