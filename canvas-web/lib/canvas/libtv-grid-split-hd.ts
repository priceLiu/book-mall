/** 宫格切分 · 高清放大倍数与提示词 */

import { parseAspectRatioToNumbers } from "./libtv-media-aspect-preset";
import type {
  Sbv1ImageAspectRatio,
  Sbv1ImageResolution,
} from "./sbv1-image-models";
import { SBV1_IMAGE_ASPECT_RATIOS } from "./sbv1-image-models";

export const LIBTV_GRID_HD_SCALE_OPTIONS = [
  { id: "1", label: "1倍" },
  { id: "1.5", label: "1.5倍" },
  { id: "2", label: "2倍" },
  { id: "4", label: "4倍" },
] as const;

export type LibtvGridHdScaleId = (typeof LIBTV_GRID_HD_SCALE_OPTIONS)[number]["id"];

export function hdScaleLabel(scaleId: string): string {
  return (
    LIBTV_GRID_HD_SCALE_OPTIONS.find((o) => o.id === scaleId)?.label ??
    `${scaleId}倍`
  );
}

export function hdResolutionForScale(scaleId: string): Sbv1ImageResolution {
  switch (scaleId) {
    case "1":
      return "1K";
    case "1.5":
    case "2":
      return "2K";
    case "4":
      return "4K";
    default:
      return "2K";
  }
}

/** 宫格高清 · 专用提示词（不继承原宫格批量生图文案） */
export function hdUpscaleDockPrompt(scaleId: string): string {
  const scale = hdScaleLabel(scaleId);
  return `根据传入的参考图，超分辨率增强为高清画质，保持内容与构图一致。输出分辨率约为原图的 ${scale}。`;
}

/** 宫格单元像素比例 → Dock 可选比例（避免 auto 落回 1:1） */
export function snapHdGridCellAspectRatio(
  cellW: number,
  cellH: number,
): Sbv1ImageAspectRatio {
  const w = Math.max(1, cellW);
  const h = Math.max(1, cellH);
  const target = w / h;
  const candidates = SBV1_IMAGE_ASPECT_RATIOS.map((r) => r.value).filter(
    (v): v is Sbv1ImageAspectRatio => v !== "auto",
  );
  let best: Sbv1ImageAspectRatio = "1:1";
  let bestDiff = Infinity;
  for (const candidate of candidates) {
    const { w: aw, h: ah } = parseAspectRatioToNumbers(candidate);
    const diff = Math.abs(Math.log(target / (aw / ah)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}
