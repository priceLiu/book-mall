import type { QrModelFeatureId, QrModelPickerEntry } from "@/lib/qr-model-picker-types";
import {
  GROK_I2V_DURATION_MAX,
  GROK_I2V_DURATION_MIN,
  GROK_I2V_RESOLUTIONS,
  HAPPYHORSE_R2V_DURATION_MAX,
  HAPPYHORSE_R2V_DURATION_MIN,
  HAPPYHORSE_R2V_RESOLUTIONS,
  KLING_TURBO_RESOLUTIONS,
  SEEDANCE20_DURATION_MAX,
  SEEDANCE20_DURATION_MIN,
  SEEDANCE20_RESOLUTIONS,
  TEXT_TO_VIDEO_MODELS,
  WAN_T2V_DURATION_MAX,
  WAN_T2V_DURATION_MIN,
  WAN_T2V_RESOLUTIONS,
  type QrTextToVideoParamProfile,
} from "@/lib/qr-template-types";

export type QrT2vProviderId = "volcengine" | "grok" | "kling" | "kie" | "wan";
export type QrT2vModelCatalogEntry = QrModelPickerEntry;

const PROVIDER_LABELS: Record<QrT2vProviderId, string> = {
  volcengine: "火山方舟",
  grok: "Grok",
  kling: "Kling",
  kie: "KIE",
  wan: "通义万相",
};

function formatResolutionTag(values: readonly { value: string }[]): string {
  if (values.length === 0) return "—";
  const norm = (v: string) => v.replace(/p$/i, "").toLowerCase();
  if (values.length === 1) return `${norm(values[0]!.value)}p`;
  const first = norm(values[0]!.value);
  const last = norm(values[values.length - 1]!.value);
  return `${first}-${last === "1080" ? "4k" : `${last}p`}`;
}

function formatDurationTag(min: number, max: number): string {
  return `${min}-${max}s`;
}

function buildT2vFeatures(args: {
  modelKey: string;
  maxRefImages: number;
  supportsSound?: boolean;
  usesImageTokens?: boolean;
  paramProfile: QrTextToVideoParamProfile;
}): QrModelFeatureId[] {
  const ids: QrModelFeatureId[] = [];
  if (args.maxRefImages > 0) ids.push("reference");
  if (args.paramProfile === "kling30" && args.maxRefImages >= 2) {
    ids.push("start-end");
  } else if (args.paramProfile === "seedance20" && args.maxRefImages > 0) {
    ids.push("start-end");
  } else if (args.maxRefImages > 0 && !args.usesImageTokens) {
    ids.push("start-frame");
  }
  if (args.supportsSound) ids.push("audio");
  if (args.modelKey === "doubao-seedance-2.0") ids.push("multi-shots");
  return ids;
}

const CATALOG_OVERRIDES: Record<
  string,
  Partial<{
    description: string;
    provider: QrT2vProviderId;
    badges: QrModelPickerEntry["badges"];
    recommended: boolean;
    heroGradient: string;
    iconLetter: string;
    iconBg: string;
    resolutionTag: string;
    durationTag: string;
  }>
> = {
  "doubao-seedance-2.0": {
    description: "电影感多镜头视频，支持音频与多图参考",
    provider: "volcengine",
    badges: ["new"],
    recommended: true,
    heroGradient: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    iconLetter: "S",
    iconBg: "#e85d04",
    resolutionTag: formatResolutionTag(SEEDANCE20_RESOLUTIONS),
    durationTag: formatDurationTag(SEEDANCE20_DURATION_MIN, SEEDANCE20_DURATION_MAX),
  },
  "grok-imagine/image-to-video": {
    description: "适合短视频与创意镜头",
    provider: "grok",
    recommended: true,
    heroGradient: "linear-gradient(135deg, #0d1117 0%, #1f2937 50%, #111827 100%)",
    iconLetter: "G",
    iconBg: "#f3f4f6",
    resolutionTag: formatResolutionTag(GROK_I2V_RESOLUTIONS),
    durationTag: formatDurationTag(GROK_I2V_DURATION_MIN, GROK_I2V_DURATION_MAX),
  },
  "kling/v3-turbo-text-to-video": {
    description: "快速文生视频，适合预览与迭代",
    provider: "kling",
    badges: ["fast"],
    heroGradient: "linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)",
    iconLetter: "K",
    iconBg: "#22c55e",
    resolutionTag: formatResolutionTag(KLING_TURBO_RESOLUTIONS),
    durationTag: "5-10s",
  },
  "kling-3.0/video": {
    description: "高品质图/文生视频，支持音频",
    provider: "kling",
    recommended: true,
    heroGradient: "linear-gradient(135deg, #111827 0%, #1e3a5f 50%, #0f172a 100%)",
    iconLetter: "K",
    iconBg: "#22c55e",
    resolutionTag: "720-4k",
    durationTag: "3-15s",
  },
  "happyhorse-1-1/reference-to-video": {
    description: "多参考图驱动，提示词 @ 引用",
    provider: "kie",
    heroGradient: "linear-gradient(135deg, #1a1025 0%, #2d1b4e 50%, #1a1025 100%)",
    iconLetter: "H",
    iconBg: "#a855f7",
    resolutionTag: formatResolutionTag(HAPPYHORSE_R2V_RESOLUTIONS),
    durationTag: formatDurationTag(HAPPYHORSE_R2V_DURATION_MIN, HAPPYHORSE_R2V_DURATION_MAX),
  },
  "wan/2-7-text-to-video": {
    description: "通义万相文生视频",
    provider: "wan",
    heroGradient: "linear-gradient(135deg, #0c1a1f 0%, #134e4a 50%, #0c1a1f 100%)",
    iconLetter: "W",
    iconBg: "#14b8a6",
    resolutionTag: formatResolutionTag(WAN_T2V_RESOLUTIONS),
    durationTag: formatDurationTag(WAN_T2V_DURATION_MIN, WAN_T2V_DURATION_MAX),
  },
};

function resolveCategory(args: {
  maxRefImages: number;
  usesImageTokens?: boolean;
}): { category: string; categoryLabel: string } {
  if (args.usesImageTokens) return { category: "image-to-video", categoryLabel: "图生视频" };
  if (args.maxRefImages === 0) return { category: "text-to-video", categoryLabel: "文生视频" };
  return { category: "hybrid", categoryLabel: "文/图生视频" };
}

export const QR_T2V_MODEL_CATALOG: QrModelPickerEntry[] = TEXT_TO_VIDEO_MODELS.map((model) => {
  const override = CATALOG_OVERRIDES[model.modelKey] ?? {};
  const { category, categoryLabel } = resolveCategory({
    maxRefImages: model.maxRefImages,
    usesImageTokens: "usesImageTokens" in model ? model.usesImageTokens : false,
  });
  const provider = override.provider ?? "kie";
  const rowFeatureIds = buildT2vFeatures({
    modelKey: model.modelKey,
    maxRefImages: model.maxRefImages,
    supportsSound: "supportsSound" in model ? model.supportsSound : false,
    usesImageTokens: "usesImageTokens" in model ? model.usesImageTokens : false,
    paramProfile: model.paramProfile,
  });
  const resolutionTag = override.resolutionTag ?? "—";
  const durationTag = override.durationTag ?? "—";
  return {
    modelKey: model.modelKey,
    label: model.label,
    description: override.description ?? model.subtitle,
    provider,
    providerLabel: PROVIDER_LABELS[provider],
    category,
    categoryLabel,
    rowFeatureIds,
    filterFeatureIds: rowFeatureIds,
    specTags: [resolutionTag, durationTag].filter((t) => t && t !== "—"),
    badges: override.badges ?? [],
    recommended: override.recommended ?? false,
    heroGradient:
      override.heroGradient ?? "linear-gradient(135deg, #1f2731 0%, #252d38 100%)",
    iconLetter: override.iconLetter ?? model.label.charAt(0).toUpperCase(),
    iconBg: override.iconBg ?? "var(--qr-brand)",
  };
});

export function getT2vModelCatalogEntry(modelKey: string): QrModelPickerEntry {
  return (
    QR_T2V_MODEL_CATALOG.find((m) => m.modelKey === modelKey.trim()) ?? QR_T2V_MODEL_CATALOG[0]!
  );
}

export const QR_T2V_PROVIDER_OPTIONS = Array.from(
  new Map(QR_T2V_MODEL_CATALOG.map((m) => [m.provider!, m.providerLabel!] as const)),
);

export const QR_T2V_CATEGORY_OPTIONS = Array.from(
  new Map(QR_T2V_MODEL_CATALOG.map((m) => [m.category!, m.categoryLabel!] as const)),
);

export const QR_T2V_FEATURE_FILTER_OPTIONS: { id: QrModelFeatureId; label: string }[] = [
  { id: "reference", label: "Reference" },
  { id: "start-end", label: "Start/End" },
  { id: "start-frame", label: "Start Frame" },
  { id: "audio", label: "Audio" },
  { id: "multi-shots", label: "Multi-shots" },
];
