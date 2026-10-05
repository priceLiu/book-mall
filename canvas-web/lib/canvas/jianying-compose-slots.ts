import type {
  JianyingLibtvAudioClipSlot,
  JianyingLibtvClipSlot,
} from "./jianying-from-workspace";

export function audioSlotByNodeId(
  audioClipSlots: readonly JianyingLibtvAudioClipSlot[],
  audioNodeId: string | undefined,
): JianyingLibtvAudioClipSlot | undefined {
  if (!audioNodeId) return undefined;
  return audioClipSlots.find((s) => s.sourceNodeId === audioNodeId);
}

export function videoClipSlotByNodeId(
  clipSlots: readonly JianyingLibtvClipSlot[],
  videoNodeId: string | undefined,
): JianyingLibtvClipSlot | undefined {
  if (!videoNodeId) return undefined;
  return clipSlots.find((s) => s.sourceNodeId === videoNodeId);
}
