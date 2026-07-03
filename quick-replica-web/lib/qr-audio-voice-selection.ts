import type { QrVoiceCatalogItem } from "@/lib/qr-audio-catalog-client";
import type { QrAudioCatalog } from "@/lib/qr-audio-catalog-client";
import { getQrAudioVoiceFromCatalog } from "@/lib/qr-audio-catalog-client";

const voiceCache = new Map<string, QrVoiceCatalogItem>();

export function cacheSelectedVoice(voice: QrVoiceCatalogItem): void {
  voiceCache.set(voice.voiceId, voice);
}

export function getCachedVoice(voiceId: string): QrVoiceCatalogItem | undefined {
  return voiceCache.get(voiceId.trim());
}

/** 中栏 Voice 展示：优先右栏缓存，其次 catalog 内联列表 */
export function resolveQrSelectedVoiceDisplay(
  catalog: QrAudioCatalog,
  voiceId: string | undefined,
): {
  voiceId: string;
  label: string;
  subtitle: string;
  avatarLetter: string;
  tags: string[];
} {
  const id = (voiceId ?? catalog.defaults.voiceId).trim();
  const cached = getCachedVoice(id);
  if (cached) {
    return {
      voiceId: cached.voiceId,
      label: cached.label,
      subtitle: cached.language ?? cached.subtitle,
      avatarLetter: cached.avatarLetter,
      tags: cached.tags ?? [],
    };
  }
  const fromCatalog = catalog.voices.find((v) => v.voiceId === id);
  if (fromCatalog) {
    return {
      voiceId: fromCatalog.voiceId,
      label: fromCatalog.label,
      subtitle: fromCatalog.subtitle,
      avatarLetter: fromCatalog.avatarLetter,
      tags: fromCatalog.tags ?? [],
    };
  }
  if (id && id !== catalog.defaults.voiceId) {
    return {
      voiceId: id,
      label: id,
      subtitle: "右栏音色列表",
      avatarLetter: id.slice(0, 1).toUpperCase(),
      tags: [],
    };
  }
  const fallback = getQrAudioVoiceFromCatalog(catalog, id);
  return {
    voiceId: fallback.voiceId,
    label: fallback.label,
    subtitle: fallback.subtitle,
    avatarLetter: fallback.avatarLetter,
    tags: fallback.tags ?? [],
  };
}
