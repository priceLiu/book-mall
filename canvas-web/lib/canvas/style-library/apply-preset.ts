import type { StoryProStyleNodeData } from "../story-pro-workspace-types";
import type { StyleLibraryPreset } from "./catalog";
import { styleLibraryPickerDefaults } from "./category-pickers";

const MAX_STYLE_REF_IMAGES = 6;

export function styleNodeFieldsLocked(d: StoryProStyleNodeData): {
  locked: boolean;
  reason?: string;
} {
  if (d.styleFinalized) {
    return { locked: true, reason: "风格已定稿，无法套用风格库条目。" };
  }
  return { locked: false };
}

export function styleNodeHasAnchorContent(d: StoryProStyleNodeData): boolean {
  return (
    Boolean(d.styleAnchorZh?.trim()) ||
    Boolean(d.styleAnchorEn?.trim()) ||
    Boolean(d.negativePrompt?.trim())
  );
}

/** 将风格库预设写入风格定义节点 data patch */
export function buildStyleLibraryPresetPatch(
  preset: StyleLibraryPreset,
  current: StoryProStyleNodeData,
  options?: { includeRefImage?: boolean },
): Partial<StoryProStyleNodeData> {
  const pickers = styleLibraryPickerDefaults(preset.category);
  const patch: Partial<StoryProStyleNodeData> = {
    mainStyle: pickers.mainStyle,
    colorTone: pickers.colorTone,
    renderQuality: pickers.renderQuality,
    styleAnchorZh: preset.prompt,
  };

  if (options?.includeRefImage && preset.imageUrl.trim()) {
    const existing = current.refImages ?? [];
    const withoutDup = existing.filter((r) => r.id !== `style-lib-${preset.id}`);
    const nextRef = {
      id: `style-lib-${preset.id}`,
      label: preset.name,
      url: preset.imageUrl,
    };
    const merged = [nextRef, ...withoutDup].slice(0, MAX_STYLE_REF_IMAGES);
    patch.refImages = merged;
  }

  return patch;
}
