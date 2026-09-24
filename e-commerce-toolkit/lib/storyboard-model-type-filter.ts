/**
 * 电商工具箱 · 模型选择弹层筛选（文生图 / 图片编辑 / 文生视频 / 图生视频）
 * 与 `StoryboardModelPickerDialog` 共用。
 */

import {
  formatStoryboardImageModelTypeLabel,
  inferStoryboardImageCapabilities,
  isStoryboardImageEditModel,
} from "@/lib/storyboard-image-model-type";
import { inferStoryboardVideoCapabilities } from "@/lib/storyboard-video-model-type";

export type StoryboardModelMediaFilter =
  | "all"
  | "image_t2i"
  | "image_edit"
  | "video_t2v"
  | "video_i2v";

export type StoryboardModelFilterTab = {
  id: StoryboardModelMediaFilter;
  label: string;
};

export const STORYBOARD_MODEL_FILTER_TABS: StoryboardModelFilterTab[] = [
  { id: "all", label: "全部" },
  { id: "image_t2i", label: "文生图" },
  { id: "image_edit", label: "图片编辑" },
  { id: "video_t2v", label: "文生视频" },
  { id: "video_i2v", label: "图生视频" },
];

/** 当前弹层 mode 下应展示哪些筛选项 */
export function storyboardModelFilterTabsForMode(
  mode: "image" | "video",
): StoryboardModelFilterTab[] {
  if (mode === "image") {
    return STORYBOARD_MODEL_FILTER_TABS.filter(
      (t) => t.id === "all" || t.id === "image_t2i" || t.id === "image_edit",
    );
  }
  return STORYBOARD_MODEL_FILTER_TABS.filter(
    (t) => t.id === "all" || t.id === "video_t2v" || t.id === "video_i2v",
  );
}

function isStoryboardImageT2iModel(modelKey: string, role?: string): boolean {
  void role;
  return inferStoryboardImageCapabilities(modelKey).includes("image_t2i");
}

function isStoryboardVideoT2vModel(modelKey: string): boolean {
  return inferStoryboardVideoCapabilities(modelKey).includes("video_t2v");
}

/** 图生视频：含 i2v / 参考生视频（R2V）/ 多参考图 */
function isStoryboardVideoI2vModel(modelKey: string): boolean {
  const caps = inferStoryboardVideoCapabilities(modelKey);
  return caps.some(
    (c) =>
      c === "video_i2v" ||
      c === "video_r2v" ||
      c === "video_multi_ref" ||
      c === "video_v2v",
  );
}

/**
 * 分镜模板目录过滤。专用选型（hideTypeFilter）必须跳过：
 * 否则 t2i 货架含 Seedream 时会把万相换背景滤掉。
 */
export function applyStoryboardPickerTemplateFilter<T extends { modelKey: string }>(
  models: T[],
  templateModelKeys: string[] | null,
  skipTemplateFilter: boolean,
): T[] {
  if (skipTemplateFilter || !templateModelKeys?.length) return models;
  const set = new Set(templateModelKeys.map((k) => k.toLowerCase()));
  const filtered = models.filter((m) => set.has(m.modelKey.toLowerCase()));
  return filtered.length > 0 ? filtered : models;
}

export function storyboardModelMatchesMediaFilter(
  model: { modelKey: string; role?: string },
  mode: "image" | "video",
  filter: StoryboardModelMediaFilter,
): boolean {
  if (filter === "all") return true;
  if (mode === "image") {
    if (filter === "image_t2i") {
      return isStoryboardImageT2iModel(model.modelKey, model.role);
    }
    if (filter === "image_edit") {
      return isStoryboardImageEditModel(model.modelKey);
    }
    return false;
  }
  if (filter === "video_t2v") return isStoryboardVideoT2vModel(model.modelKey);
  if (filter === "video_i2v") return isStoryboardVideoI2vModel(model.modelKey);
  return false;
}

export { formatStoryboardImageModelTypeLabel };
