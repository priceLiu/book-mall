export type QrModelBadge = "new" | "fast";

export type QrModelFeatureId =
  | "reference"
  | "start-end"
  | "start-frame"
  | "audio"
  | "multi-shots"
  | "motion-control"
  | "character-ref"
  | "text-to-image"
  | "image-to-image"
  | "text-to-speech"
  | "voice-clone"
  | "voice-change"
  | "sfx"
  | "music"
  | "multi-lang"
  | "hd";

export type QrModelPickerEntry = {
  modelKey: string;
  label: string;
  description: string;
  iconLetter: string;
  iconBg: string;
  badges?: QrModelBadge[];
  recommended?: boolean;
  heroGradient?: string;
  provider?: string;
  providerLabel?: string;
  category?: string;
  categoryLabel?: string;
  /** 列表行上方能力标签 */
  rowFeatureIds: QrModelFeatureId[];
  /** 筛选器用（可含不展示在行的能力） */
  filterFeatureIds: QrModelFeatureId[];
  /** 列表行下方规格标签（分辨率、秒数等） */
  specTags: string[];
};

export const QR_MODEL_ROW_FEATURE_ORDER: QrModelFeatureId[] = [
  "reference",
  "start-end",
  "start-frame",
  "audio",
  "multi-shots",
  "motion-control",
  "character-ref",
  "text-to-image",
  "image-to-image",
  "text-to-speech",
  "voice-clone",
  "voice-change",
  "sfx",
  "music",
  "multi-lang",
  "hd",
];

const FEATURE_LABELS: Record<QrModelFeatureId, string> = {
  reference: "Reference",
  "start-end": "Start/End",
  "start-frame": "Start Frame",
  audio: "Audio",
  "multi-shots": "Multi-shots",
  "motion-control": "Motion",
  "character-ref": "Character",
  "text-to-image": "Text",
  "image-to-image": "Image",
  "text-to-speech": "TTS",
  "voice-clone": "Clone",
  "voice-change": "STS",
  sfx: "SFX",
  music: "Music",
  "multi-lang": "Multi-lang",
  hd: "HD",
};

export function qrModelFeatureLabel(feature: QrModelFeatureId): string {
  return FEATURE_LABELS[feature];
}

export function qrModelPickerRowFeatures(entry: QrModelPickerEntry): QrModelFeatureId[] {
  return QR_MODEL_ROW_FEATURE_ORDER.filter((id) => entry.rowFeatureIds.includes(id));
}
