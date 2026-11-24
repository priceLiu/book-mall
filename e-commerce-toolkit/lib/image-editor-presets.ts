import type { ImageEditorPresetSize, ImageEditorRatioPreset } from "@/lib/image-editor-types";

/** 尺寸调整 · 预设列表（对齐美图设计室「尺寸调整」） */
export const IMAGE_EDITOR_ECOM_SIZE_PRESETS: ImageEditorPresetSize[] = [
  { id: "wx-oa-cover", label: "公众号首图", width: 900, height: 383 },
  { id: "wx-oa-sub", label: "公众号次图", width: 200, height: 200 },
  { id: "wx-moments", label: "朋友圈封面", width: 1080, height: 1080 },
  { id: "pc-wallpaper", label: "电脑壁纸", width: 1920, height: 1080 },
  { id: "logo", label: "Logo设计", width: 500, height: 500 },
  { id: "main-square", label: "方形主图", width: 800, height: 800 },
  { id: "main-vertical", label: "竖版主图", width: 800, height: 1200 },
  { id: "pdd-home", label: "拼多多店铺首页", width: 750, height: 1000 },
  { id: "photo-1r", label: "标准1寸/1R", width: 295, height: 413 },
  { id: "photo-2r", label: "标准2寸/2R", width: 413, height: 626 },
  { id: "id-card", label: "二代身份证", width: 358, height: 441 },
  { id: "tb-main", label: "淘宝主图", width: 800, height: 800 },
  { id: "xhs-cover", label: "小红书封面", width: 1242, height: 1660 },
  { id: "douyin-cover", label: "抖音封面", width: 1080, height: 1920 },
  { id: "poster-2k", label: "通用 2K 方图", width: 2048, height: 2048 },
];

export function formatImageEditorPresetPixels(width: number, height: number): string {
  return `${width} * ${height} px`;
}

/** 比例裁剪列表（对齐美图设计室） */
export const IMAGE_EDITOR_RATIO_PRESETS: ImageEditorRatioPreset[] = [
  { id: "1:1", label: "1:1 正方形", w: 1, h: 1 },
  { id: "2:3", label: "2:3 单反相机 (竖)", w: 2, h: 3 },
  { id: "3:2", label: "3:2 单反相机 (横)", w: 3, h: 2 },
  { id: "3:4", label: "3:4 标准屏幕 (竖)", w: 3, h: 4 },
  { id: "4:3", label: "4:3 标准屏幕 (横)", w: 4, h: 3 },
  { id: "9:16", label: "9:16 视频竖屏", w: 9, h: 16 },
  { id: "16:9", label: "16:9 视频横屏", w: 16, h: 9 },
  { id: "9:18", label: "9:18 全面屏 (竖)", w: 9, h: 18 },
  { id: "18:9", label: "18:9 全面屏 (横)", w: 18, h: 9 },
  { id: "5:3", label: "5:3 宽屏相册", w: 5, h: 3 },
];

export function dimensionsForImageEditorRatio(
  w: number,
  h: number,
  base = 1080,
): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: base, height: base };
  if (w >= h) {
    return { width: base, height: Math.round((base * h) / w) };
  }
  return { width: Math.round((base * w) / h), height: base };
}

export const IMAGE_EDITOR_CUSTOM_PRESETS_KEY = "ecom-image-editor-custom-sizes";

export function readImageEditorCustomPresets(): ImageEditorPresetSize[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(IMAGE_EDITOR_CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ImageEditorPresetSize[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeImageEditorCustomPresets(items: ImageEditorPresetSize[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(IMAGE_EDITOR_CUSTOM_PRESETS_KEY, JSON.stringify(items.slice(0, 20)));
  } catch {
    /* ignore */
  }
}