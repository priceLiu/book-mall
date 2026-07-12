import type { QrModelFeatureId, QrModelPickerEntry } from "@/lib/qr-model-picker-types";
import {
  FLUX2_RESOLUTIONS,
  GPT_IMAGE_2_RESOLUTIONS,
  NANO_PRO_RESOLUTIONS,
  TEXT_TO_IMAGE_MODELS,
} from "@/lib/qr-template-types";

function formatImageResolutionTag(values: readonly { value: string }[]): string {
  if (!values.length) return "—";
  if (values.length === 1) return values[0]!.value;
  return `${values[0]!.value}-${values[values.length - 1]!.value}`;
}

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
    resolutionTag: string;
    rowFeatureIds: QrModelFeatureId[];
  }>
> = {
  "lib-nano-pro": {
    description: "高质量文/图生图，多参考图",
    provider: "google",
    providerLabel: "Google",
    recommended: true,
    iconLetter: "N",
    iconBg: "#4285f4",
    resolutionTag: formatImageResolutionTag(NANO_PRO_RESOLUTIONS),
    rowFeatureIds: ["reference", "text-to-image", "image-to-image", "hd"],
  },
  "grok-imagine/text-to-image": {
    description: "快速文生图",
    provider: "grok",
    providerLabel: "Grok",
    iconLetter: "G",
    iconBg: "#f3f4f6",
    resolutionTag: "1K",
    rowFeatureIds: ["text-to-image"],
  },
  "flux-2-pro": {
    description: "专业级文/图生图",
    provider: "bfl",
    providerLabel: "BFL",
    recommended: true,
    iconLetter: "F",
    iconBg: "#6366f1",
    resolutionTag: formatImageResolutionTag(FLUX2_RESOLUTIONS),
    rowFeatureIds: ["reference", "text-to-image", "image-to-image", "hd"],
  },
  "seedream-5-lite": {
    description: "轻量文/图生图",
    provider: "bytedance",
    providerLabel: "字节",
    iconLetter: "S",
    iconBg: "#e85d04",
    resolutionTag: "2K",
    rowFeatureIds: ["reference", "text-to-image", "image-to-image"],
  },
  "seedream-4.5": {
    description: "文/图生图",
    provider: "bytedance",
    providerLabel: "字节",
    iconLetter: "S",
    iconBg: "#e85d04",
    resolutionTag: "2K",
    rowFeatureIds: ["reference", "text-to-image", "image-to-image"],
  },
  "gpt-image-2": {
    description: "OpenAI 文/图生图",
    provider: "openai",
    providerLabel: "OpenAI",
    iconLetter: "O",
    iconBg: "#10a37f",
    resolutionTag: formatImageResolutionTag(GPT_IMAGE_2_RESOLUTIONS),
    rowFeatureIds: ["reference", "text-to-image", "image-to-image", "hd"],
  },
  "gpt-image-1": {
    description: "OpenAI 文/图生图",
    provider: "openai",
    providerLabel: "OpenAI",
    iconLetter: "O",
    iconBg: "#10a37f",
    resolutionTag: "1K",
    rowFeatureIds: ["reference", "text-to-image", "image-to-image"],
  },
  "qwen-text-to-image": {
    description: "通义千问文/图生图",
    provider: "qwen",
    providerLabel: "通义",
    iconLetter: "Q",
    iconBg: "#14b8a6",
    resolutionTag: "1K",
    rowFeatureIds: ["reference", "text-to-image", "image-to-image"],
  },
};

function defaultRowFeatures(maxRefImages: number): QrModelFeatureId[] {
  const ids: QrModelFeatureId[] = ["text-to-image"];
  if (maxRefImages > 0) {
    ids.unshift("reference");
    ids.push("image-to-image");
  }
  return ids;
}

export const QR_T2I_MODEL_CATALOG: QrModelPickerEntry[] = TEXT_TO_IMAGE_MODELS.map((model) => {
  const override = OVERRIDES[model.modelKey] ?? {};
  const rowFeatureIds = override.rowFeatureIds ?? defaultRowFeatures(model.maxRefImages);
  const resolutionTag = override.resolutionTag ?? "—";
  return {
    modelKey: model.modelKey,
    label: model.label,
    description: override.description ?? model.subtitle,
    provider: override.provider ?? "other",
    providerLabel: override.providerLabel ?? "其他",
    category: model.maxRefImages > 0 ? "hybrid" : "text-to-image",
    categoryLabel: model.maxRefImages > 0 ? "文/图生图" : "文生图",
    rowFeatureIds,
    filterFeatureIds: rowFeatureIds,
    specTags: resolutionTag !== "—" ? [resolutionTag] : [],
    badges: override.badges ?? [],
    recommended: override.recommended ?? false,
    heroGradient:
      override.heroGradient ?? "linear-gradient(135deg, #1f2731 0%, #252d38 100%)",
    iconLetter: override.iconLetter ?? model.label.charAt(0).toUpperCase(),
    iconBg: override.iconBg ?? "var(--qr-brand)",
  };
});

export function getT2iModelCatalogEntry(modelKey: string): QrModelPickerEntry {
  return (
    QR_T2I_MODEL_CATALOG.find((m) => m.modelKey === modelKey.trim()) ?? QR_T2I_MODEL_CATALOG[0]!
  );
}

export const QR_T2I_PROVIDER_OPTIONS = Array.from(
  new Map(QR_T2I_MODEL_CATALOG.map((m) => [m.provider!, m.providerLabel!] as const)),
);

export const QR_T2I_CATEGORY_OPTIONS = Array.from(
  new Map(QR_T2I_MODEL_CATALOG.map((m) => [m.category!, m.categoryLabel!] as const)),
);

export const QR_T2I_FEATURE_FILTER_OPTIONS: { id: QrModelFeatureId; label: string }[] = [
  { id: "reference", label: "Reference" },
  { id: "text-to-image", label: "Text" },
  { id: "image-to-image", label: "Image" },
  { id: "hd", label: "HD" },
];
