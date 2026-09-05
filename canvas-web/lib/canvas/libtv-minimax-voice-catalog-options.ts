import type { LibtvVoiceCatalogItem } from "@/lib/canvas/libtv-audio-voice-catalog-client";

/** 同一 MiniMax voiceId 只保留一条（克隆目录按时间新→旧，先出现的优先） */
export function dedupeLibtvVoiceCatalogItems(
  items: LibtvVoiceCatalogItem[],
): LibtvVoiceCatalogItem[] {
  const seen = new Set<string>();
  const out: LibtvVoiceCatalogItem[] = [];
  for (const item of items) {
    const id = item.voiceId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

export function libtvMinimaxVoiceSelectOptions(
  items: LibtvVoiceCatalogItem[],
): Array<{
  value: string;
  rowKey: string;
  label: string;
  language?: string;
  subtitle: string;
  previewUrl?: string;
  sampleText?: string;
  disabled: boolean;
}> {
  return items.map((voice) => {
    const meta = (voice.language ?? voice.subtitle ?? "").trim();
    return {
      value: voice.voiceId,
      rowKey: voice.catalogId ?? voice.voiceId,
      label: voice.label,
      language: voice.language,
      subtitle: meta,
      previewUrl: voice.previewUrl,
      sampleText: voice.sampleText,
      disabled: voice.selectable === false,
    };
  });
}
