import type { QrModelFeatureId, QrModelPickerEntry } from "@/lib/qr-model-picker-types";
import {
  HAPPYHORSE_R2V_DURATION_MAX,
  HAPPYHORSE_R2V_DURATION_MIN,
  MOTION_SYNC_MODELS,
} from "@/lib/qr-template-types";

const OVERRIDES: Record<
  string,
  Partial<{
    description: string;
    provider: string;
    providerLabel: string;
    badges: QrModelPickerEntry["badges"];
    recommended: boolean;
    heroGradient: string;
    iconLetter: string;
    iconBg: string;
    rowFeatureIds: QrModelFeatureId[];
    specTags: string[];
  }>
> = {
  "kling-2.6/motion-control": {
    description: "角色图 + 参考视频运动模仿",
    provider: "kling",
    providerLabel: "Kling",
    iconLetter: "K",
    iconBg: "#22c55e",
    rowFeatureIds: ["motion-control", "character-ref", "reference"],
    specTags: ["720-1080p", "3-30s"],
  },
  "kling-3.0/motion-control": {
    description: "高品质运动模仿",
    provider: "kling",
    providerLabel: "Kling",
    recommended: true,
    badges: ["new"],
    iconLetter: "K",
    iconBg: "#22c55e",
    rowFeatureIds: ["motion-control", "character-ref", "reference"],
    specTags: ["720-4k", "3-30s"],
  },
  "happyhorse-1-1/reference-to-video": {
    description: "多参考图驱动，提示词 @ 引用",
    provider: "kie",
    providerLabel: "KIE",
    iconLetter: "H",
    iconBg: "#a855f7",
    rowFeatureIds: ["reference", "character-ref", "multi-shots"],
    specTags: ["720-1080p", `${HAPPYHORSE_R2V_DURATION_MIN}-${HAPPYHORSE_R2V_DURATION_MAX}s`],
  },
};

export const QR_MOTION_SYNC_MODEL_CATALOG: QrModelPickerEntry[] = MOTION_SYNC_MODELS.map(
  (model) => {
    const override = OVERRIDES[model.modelKey] ?? {};
    const isHappyHorse = model.kind === "reference-to-video";
    return {
      modelKey: model.modelKey,
      label: model.label,
      description: override.description ?? model.subtitle,
      provider: override.provider ?? (isHappyHorse ? "kie" : "kling"),
      providerLabel: override.providerLabel ?? (isHappyHorse ? "KIE" : "Kling"),
      category: isHappyHorse ? "reference-to-video" : "motion-control",
      categoryLabel: isHappyHorse ? "参考图生视频" : "运动模仿",
      rowFeatureIds:
        override.rowFeatureIds ??
        (isHappyHorse
          ? ["reference", "character-ref"]
          : ["motion-control", "character-ref", "reference"]),
      filterFeatureIds:
        override.rowFeatureIds ??
        (isHappyHorse
          ? ["reference", "character-ref"]
          : ["motion-control", "character-ref", "reference"]),
      specTags:
        override.specTags ??
        (model.defaultMode === "pro" ? ["720-4k", "3-30s"] : ["720-1080p", "3-30s"]),
      badges: override.badges ?? [],
      recommended: override.recommended ?? false,
      heroGradient:
        override.heroGradient ?? "linear-gradient(135deg, #1f2731 0%, #252d38 100%)",
      iconLetter: override.iconLetter ?? model.label.charAt(0).toUpperCase(),
      iconBg: override.iconBg ?? "var(--qr-brand)",
    };
  },
);

export function getMotionSyncModelCatalogEntry(modelKey: string): QrModelPickerEntry {
  return (
    QR_MOTION_SYNC_MODEL_CATALOG.find((m) => m.modelKey === modelKey.trim()) ??
    QR_MOTION_SYNC_MODEL_CATALOG[0]!
  );
}

export const QR_MOTION_SYNC_PROVIDER_OPTIONS = Array.from(
  new Map(QR_MOTION_SYNC_MODEL_CATALOG.map((m) => [m.provider!, m.providerLabel!] as const)),
);

export const QR_MOTION_SYNC_CATEGORY_OPTIONS = Array.from(
  new Map(QR_MOTION_SYNC_MODEL_CATALOG.map((m) => [m.category!, m.categoryLabel!] as const)),
);

export const QR_MOTION_SYNC_FEATURE_FILTER_OPTIONS: { id: QrModelFeatureId; label: string }[] = [
  { id: "motion-control", label: "Motion" },
  { id: "character-ref", label: "Character" },
  { id: "reference", label: "Reference" },
  { id: "multi-shots", label: "Multi-shots" },
];
