/**
 * 电商工具箱 · 媒体展示 Tier（SSOT）
 * 权威说明：design/MEDIA.md §展示 Tier
 */

import { ECOM_LIBRARY_MEDIA_GRID_CLASS } from "@/components/media/ecom-media-library-tile";
import {
  ECOM_WORKSPACE_RESULT_GRID_CLASS,
  ECOM_WORKSPACE_RESULT_IMAGE_ASPECT,
  ECOM_WORKSPACE_RESULT_VIDEO_ASPECT,
} from "@/lib/ecom-workspace-result-grid";

/** 本轮媒体统一 · 禁止改 UI 的目录前缀（相对 e-commerce-toolkit） */
export const ECOM_MEDIA_EXEMPT_PATH_PREFIXES = [
  "components/vton/",
  "components/hand-craft/",
  "components/brand-vi/",
  "app/ecom/model-tryon/",
] as const;

export type EcomMediaDisplayTier =
  | "library"
  | "workspace-result"
  | "deliverable-video"
  | "adaptive-brand-mark"
  | "gallery-strip"
  | "table-cell";

export const ECOM_MEDIA_TIER_LIBRARY_GRID = ECOM_LIBRARY_MEDIA_GRID_CLASS;
export const ECOM_MEDIA_TIER_WORKSPACE_GRID = ECOM_WORKSPACE_RESULT_GRID_CLASS;
export const ECOM_MEDIA_TIER_WORKSPACE_IMAGE_ASPECT = ECOM_WORKSPACE_RESULT_IMAGE_ASPECT;
export const ECOM_MEDIA_TIER_WORKSPACE_VIDEO_ASPECT = ECOM_WORKSPACE_RESULT_VIDEO_ASPECT;

/** Logo / 方标主预览最大宽度（自适应，非固定槽 px） */
export const ECOM_ADAPTIVE_BRAND_MARK_MAX_PX = 280;

export const ECOM_ADAPTIVE_BRAND_MARK_GRID_CLASS =
  "grid w-full grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4";

export type DeliverableVideoAspect = "9:16" | "16:9" | "1:1";

/** 最终成片默认竖屏（与电商口播故事版一致） */
export function resolveDeliverableVideoAspect(
  _moduleId?: string,
): DeliverableVideoAspect {
  return "9:16";
}

export function isEcomMediaExemptPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  return ECOM_MEDIA_EXEMPT_PATH_PREFIXES.some((p) => norm.includes(p));
}

const BRAND_MARK_LABEL_RE = /logo|方标|标识|brand/i;

/** 主图 / 海报 · 1:1 Logo 类槽（T2logo） */
export function isProductDesignBrandMarkSlot(
  ratio: string,
  ...textParts: Array<string | undefined | null>
): boolean {
  if (ratio !== "1:1") return false;
  const hay = textParts.filter(Boolean).join(" ");
  return BRAND_MARK_LABEL_RE.test(hay);
}