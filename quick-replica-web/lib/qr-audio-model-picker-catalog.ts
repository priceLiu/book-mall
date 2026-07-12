import type { QrAudioCatalogModel } from "@/lib/qr-audio-catalog-client";
import type { QrModelFeatureId, QrModelPickerEntry } from "@/lib/qr-model-picker-types";

export type QrAudioPickerKind =
  | "create-voiceover"
  | "voice-changer"
  | "voice-clone"
  | "create-sfx"
  | "create-music";

function providerStyle(provider: string): { iconLetter: string; iconBg: string } {
  if (provider === "elevenlabs") return { iconLetter: "E", iconBg: "#111827" };
  if (provider === "minimax") return { iconLetter: "M", iconBg: "#7c3aed" };
  return { iconLetter: provider.charAt(0).toUpperCase(), iconBg: "var(--qr-brand)" };
}

function inferAudioFeatures(modelKey: string, kind: QrAudioPickerKind): QrModelFeatureId[] {
  const key = modelKey.toLowerCase();
  if (kind === "voice-clone") return ["voice-clone", "hd", "multi-lang"];
  if (kind === "voice-changer") return ["voice-change", "hd"];
  if (kind === "create-sfx") return ["sfx", "hd"];
  if (kind === "create-music") return ["music", "hd"];
  if (key.includes("turbo")) return ["text-to-speech", "hd"];
  if (key.includes("hd")) return ["text-to-speech", "hd", "multi-lang"];
  return ["text-to-speech", "multi-lang"];
}

function inferAudioSpecTags(modelKey: string, kind: QrAudioPickerKind): string[] {
  const key = modelKey.toLowerCase();
  if (kind === "create-sfx") return ["1-22s"];
  if (kind === "create-music") return ["30-300s"];
  if (kind === "voice-clone") return ["HD"];
  if (kind === "voice-changer") return ["HD"];
  if (key.includes("turbo")) return ["Turbo"];
  if (key.includes("hd")) return ["HD"];
  return ["Standard"];
}

function inferCategory(kind: QrAudioPickerKind): { category: string; categoryLabel: string } {
  if (kind === "voice-clone") return { category: "voice-clone", categoryLabel: "声音克隆" };
  if (kind === "voice-changer") return { category: "voice-changer", categoryLabel: "变声" };
  if (kind === "create-sfx") return { category: "sfx", categoryLabel: "音效" };
  if (kind === "create-music") return { category: "music", categoryLabel: "音乐" };
  return { category: "tts", categoryLabel: "旁白" };
}

export function getAudioModelCatalogEntry(
  catalog: QrModelPickerEntry[],
  modelKey: string,
): QrModelPickerEntry {
  return catalog.find((m) => m.modelKey === modelKey.trim()) ?? catalog[0]!;
}

export function buildAudioProviderOptions(catalog: QrModelPickerEntry[]) {
  return Array.from(
    new Map(catalog.map((m) => [m.provider!, m.providerLabel!] as const)),
  );
}

export function buildAudioModelPickerCatalog(
  models: QrAudioCatalogModel[],
  kind: QrAudioPickerKind,
): QrModelPickerEntry[] {
  const { category, categoryLabel } = inferCategory(kind);
  return models.map((model, index) => {
    const style = providerStyle(model.provider);
    const rowFeatureIds = inferAudioFeatures(model.modelKey, kind);
    return {
      modelKey: model.modelKey,
      label: model.label,
      description: model.subtitle,
      provider: model.provider,
      providerLabel: model.provider === "elevenlabs" ? "ElevenLabs" : "MiniMax",
      category,
      categoryLabel,
      rowFeatureIds,
      filterFeatureIds: rowFeatureIds,
      specTags: inferAudioSpecTags(model.modelKey, kind),
      recommended: index === 0,
      iconLetter: style.iconLetter,
      iconBg: style.iconBg,
      heroGradient: "linear-gradient(135deg, #1a1025 0%, #2d1b4e 50%, #1a1025 100%)",
    };
  });
}

export const QR_AUDIO_FEATURE_FILTER_OPTIONS: { id: QrModelFeatureId; label: string }[] = [
  { id: "text-to-speech", label: "TTS" },
  { id: "voice-clone", label: "Clone" },
  { id: "voice-change", label: "STS" },
  { id: "sfx", label: "SFX" },
  { id: "music", label: "Music" },
  { id: "multi-lang", label: "Multi-lang" },
  { id: "hd", label: "HD" },
];
