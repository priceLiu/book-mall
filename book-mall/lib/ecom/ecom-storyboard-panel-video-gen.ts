import {
  storyboardPanelVideoGenSchema,
  type StoryboardPanelVideoGen,
} from "@/lib/ecom/ecom-storyboard-types";

export type StoryboardPanelVideoAssetRecord = StoryboardPanelVideoGen & {
  url: string;
};

export function parseStoryboardPanelVideoGenFromAssetMeta(
  meta: unknown,
): StoryboardPanelVideoGen | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const modelKey =
    typeof m.modelKey === "string" && m.modelKey.trim() ? m.modelKey.trim() : "";
  const durationSec =
    typeof m.durationSec === "number" && Number.isFinite(m.durationSec)
      ? m.durationSec
      : NaN;
  if (!modelKey || !(durationSec > 0)) return null;
  const parsed = storyboardPanelVideoGenSchema.safeParse({
    modelKey,
    durationSec,
    ...(typeof m.resolution === "string" && m.resolution.trim()
      ? { resolution: m.resolution.trim() }
      : {}),
    ...(m.aspectRatio === "16:9" || m.aspectRatio === "9:16"
      ? { aspectRatio: m.aspectRatio }
      : {}),
    ...(typeof m.generatedAt === "string" && m.generatedAt.trim()
      ? { generatedAt: m.generatedAt.trim() }
      : {}),
  });
  return parsed.success ? parsed.data : null;
}

export function mergeStoryboardPanelVideoGen(
  panelGen: StoryboardPanelVideoGen | undefined,
  assetGen: StoryboardPanelVideoGen | null,
): StoryboardPanelVideoGen | undefined {
  if (panelGen?.modelKey?.trim()) return panelGen;
  return assetGen ?? undefined;
}
