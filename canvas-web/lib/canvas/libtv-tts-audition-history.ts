export type LibtvTtsAuditionHistoryItem = {
  voiceId: string;
  label: string;
  subtitle?: string;
  sampleText?: string;
  language?: string;
  dataUrl: string;
};

export const LIBTV_TTS_AUDITION_HISTORY_MAX = 8;

/** 调参试听成功后写入：同 voiceId 置顶覆盖，最多保留 8 条 */
export function upsertLibtvTtsAuditionHistory(
  prev: LibtvTtsAuditionHistoryItem[],
  item: LibtvTtsAuditionHistoryItem,
): LibtvTtsAuditionHistoryItem[] {
  const id = item.voiceId.trim();
  if (!id) return prev;
  return [
    { ...item, voiceId: id },
    ...prev.filter((row) => row.voiceId !== id),
  ].slice(0, LIBTV_TTS_AUDITION_HISTORY_MAX);
}
