/** 与 e-commerce-toolkit/lib/storyboard-scene-presets.ts key 保持一致 */

const PRESET_IMAGE_HINTS: Record<string, string> = {
  bedroom: "cozy home bedroom interior, wardrobe and soft natural window light",
  living_room:
    "modern home living room with sofa, coffee table, bright residential lighting",
  dining_room:
    "home dining room with dining table and chairs, warm mealtime atmosphere",
  kitchen:
    "bright home kitchen with counter, sink, clean cooking environment lighting",
  indoor:
    "generic bright indoor room, neutral modern interior, soft diffused lighting",
  sports_venue:
    "indoor sports court or gymnasium, athletic venue lighting, active atmosphere",
  mall: "shopping mall interior, store displays, commercial atrium lighting",
  office: "modern office desk or meeting room, workplace fluorescent lighting",
  outdoor_street:
    "urban outdoor street scene, sidewalk, natural daylight city background",
};

const PRESET_LABELS: Record<string, string> = {
  bedroom: "卧室",
  living_room: "客厅",
  dining_room: "餐厅",
  kitchen: "厨房",
  indoor: "室内",
  sports_venue: "运动场",
  mall: "商场",
  office: "办公室",
  outdoor_street: "户外街头",
};

export function resolveScenePresetImageHint(
  key?: string | null,
  customDescription?: string | null,
): string | undefined {
  if (key === "custom" && customDescription?.trim()) {
    return `user specified environment: ${customDescription.trim()}`;
  }
  if (!key?.trim()) return undefined;
  return PRESET_IMAGE_HINTS[key.trim()];
}

export function resolveScenePresetLabel(
  key?: string | null,
  customDescription?: string | null,
): string | undefined {
  if (key === "custom" && customDescription?.trim()) {
    return customDescription.trim();
  }
  if (!key?.trim()) return undefined;
  return PRESET_LABELS[key.trim()];
}
