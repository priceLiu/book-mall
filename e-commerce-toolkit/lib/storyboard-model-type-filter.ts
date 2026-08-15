/**
 * 电商工具箱 · 模型选择弹层筛选（文生图 / 文生视频 / 图生视频）
 * 与 `StoryboardModelPickerDialog` 共用。
 */

import { inferStoryboardVideoCapabilities } from "@/lib/storyboard-video-model-type";

export type StoryboardModelMediaFilter = "all" | "image_t2i" | "video_t2v" | "video_i2v";

export type StoryboardModelFilterTab = {
  id: StoryboardModelMediaFilter;
  label: string;
};

export const STORYBOARD_MODEL_FILTER_TABS: StoryboardModelFilterTab[] = [
  { id: "all", label: "全部" },
  { id: "image_t2i", label: "文生图" },
  { id: "video_t2v", label: "文生视频" },
  { id: "video_i2v", label: "图生视频" },
];

/** 当前弹层 mode 下应展示哪些筛选项 */
export function storyboardModelFilterTabsForMode(
  _mode: "image" | "video",
): StoryboardModelFilterTab[] {
  return STORYBOARD_MODEL_FILTER_TABS;
}

function isStoryboardImageT2iModel(modelKey: string, role?: string): boolean {
  const k = modelKey.trim().toLowerCase();
  if (role === "IMAGE") {
    if (
      k.includes("i2i") ||
      k.includes("img2img") ||
      k.includes("image-to-image") ||
      k.includes("/edit") ||
      k.includes("kontext")
    ) {
      return k.includes("t2i") || k.includes("text-to-image") || k.includes("seedream");
    }
    return true;
  }
  return (
    k.includes("t2i") ||
    k.includes("text-to-image") ||
    k.includes("seedream") ||
    k.includes("wan") && k.includes("image")
  );
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

export function storyboardModelMatchesMediaFilter(
  model: { modelKey: string; role?: string },
  mode: "image" | "video",
  filter: StoryboardModelMediaFilter,
): boolean {
  if (filter === "all") return true;
  if (mode === "image") {
    return filter === "image_t2i" && isStoryboardImageT2iModel(model.modelKey, model.role);
  }
  if (filter === "video_t2v") return isStoryboardVideoT2vModel(model.modelKey);
  if (filter === "video_i2v") return isStoryboardVideoI2vModel(model.modelKey);
  return false;
}

export function formatStoryboardImageModelTypeLabel(modelKey: string, role?: string): string {
  if (isStoryboardImageT2iModel(modelKey, role)) return "文生图";
  return role === "IMAGE" ? "生图" : "IMAGE";
}
