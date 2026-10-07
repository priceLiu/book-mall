import { resolveLayerTextBg } from "./text-effects";
import type { EcomCopyOverlayLayer } from "./types";

/** 与编辑画布一致：字底衬底用紧凑行高，避免 line-height 上下留白导致衬底「往上漂」 */
export function overlayLineHeightPx(layer: EcomCopyOverlayLayer): number {
  return resolveLayerTextBg(layer) ? layer.fontSize : layer.fontSize * 1.25;
}

/** 与浏览器中文排版接近的成图宽估算（SVG 无 DOM 度量时用） */
export function estimateLineWidthPx(
  line: string,
  fontSize: number,
  bold: boolean,
): number {
  const wScale = bold ? 1.05 : 1;
  let w = 0;
  for (const ch of line) {
    if (/[\u0020-\u007e]/.test(ch)) w += fontSize * 0.52 * wScale;
    else w += fontSize * 0.9 * wScale;
  }
  return w;
}

/** 与编辑画布 pre-wrap 一致：仅按 \\n 分段，超长行按估算宽度软换行（不用固定字数硬切） */
export function composeOverlayTextLines(
  text: string,
  fontSize: number,
  bold: boolean,
  maxWidthPx: number,
): string[] {
  const out: string[] = [];
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (const paragraph of normalized.split("\n")) {
    if (!paragraph.length) {
      out.push("");
      continue;
    }
    let rest = paragraph;
    while (rest.length > 0) {
      if (estimateLineWidthPx(rest, fontSize, bold) <= maxWidthPx) {
        out.push(rest);
        break;
      }
      let cut = 1;
      while (
        cut < rest.length &&
        estimateLineWidthPx(rest.slice(0, cut + 1), fontSize, bold) <= maxWidthPx
      ) {
        cut += 1;
      }
      out.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
  }
  return out.length ? out : [""];
}

export function estimateTextBlockSizePx(
  lines: string[],
  fontSize: number,
  bold: boolean,
  maxWidthPx: number,
): { textW: number; textH: number; lineHeight: number } {
  const lineHeight = fontSize * 1.25;
  const nonEmpty = lines.filter((l) => l.length > 0);
  const useLines = nonEmpty.length ? nonEmpty : [""];
  const textW = Math.min(
    maxWidthPx,
    Math.max(1, ...useLines.map((l) => estimateLineWidthPx(l, fontSize, bold))),
  );
  const textH = useLines.length * lineHeight;
  return { textW, textH, lineHeight };
}

/** 与画布一致：nx/ny 为衬底外框顶边锚点（左 / 中 / 右） */
export function resolveHorizontalTextBoxLayout(
  layer: EcomCopyOverlayLayer,
  canvasW: number,
  canvasH: number,
  lines: string[],
  maxWidthPx: number,
): {
  boxX: number;
  boxY: number;
  boxW: number;
  boxH: number;
  textX: number;
  textY: number;
  textAnchor: "start" | "middle" | "end";
  lineHeight: number;
} {
  const anchorX = layer.nx * canvasW;
  const anchorY = layer.ny * canvasH;
  const align = layer.textAlign ?? "center";
  const bold = layer.fontWeight !== "normal";
  const lineHeight = overlayLineHeightPx(layer);
  let textW = estimateTextBlockSizePx(lines, layer.fontSize, bold, maxWidthPx).textW;
  const lineCount = Math.max(1, lines.filter((l) => l.length > 0).length || lines.length);
  let textH = lineCount * lineHeight;
  if (
    Number.isFinite(layer.layoutTextWidthNorm) &&
    layer.layoutTextWidthNorm != null &&
    layer.layoutTextWidthNorm > 0
  ) {
    textW = Math.min(maxWidthPx, layer.layoutTextWidthNorm * canvasW);
  }
  if (
    Number.isFinite(layer.layoutTextHeightNorm) &&
    layer.layoutTextHeightNorm != null &&
    layer.layoutTextHeightNorm > 0
  ) {
    textH = layer.layoutTextHeightNorm * canvasH;
  }
  const bg = resolveLayerTextBg(layer);
  const pad = bg?.paddingPx ?? 0;
  let boxW = textW + pad * 2;
  let boxH = textH + pad * 2;
  if (
    bg &&
    Number.isFinite(layer.layoutBoxWidthPx) &&
    layer.layoutBoxWidthPx != null &&
    layer.layoutBoxWidthPx > 0 &&
    Number.isFinite(layer.layoutBoxHeightPx) &&
    layer.layoutBoxHeightPx != null &&
    layer.layoutBoxHeightPx > 0
  ) {
    boxW = Math.min(canvasW, Math.round(layer.layoutBoxWidthPx));
    boxH = Math.min(canvasH, Math.round(layer.layoutBoxHeightPx));
    textW = Math.max(1, boxW - pad * 2);
    textH = Math.max(1, boxH - pad * 2);
  } else if (
    bg &&
    Number.isFinite(layer.layoutBoxWidthNorm) &&
    layer.layoutBoxWidthNorm != null &&
    layer.layoutBoxWidthNorm > 0 &&
    Number.isFinite(layer.layoutBoxHeightNorm) &&
    layer.layoutBoxHeightNorm != null &&
    layer.layoutBoxHeightNorm > 0
  ) {
    boxW = Math.min(canvasW, layer.layoutBoxWidthNorm * canvasW);
    boxH = Math.min(canvasH, layer.layoutBoxHeightNorm * canvasH);
    textW = Math.max(1, boxW - pad * 2);
    textH = Math.max(1, boxH - pad * 2);
  }

  let boxX = anchorX;
  if (align === "center") boxX = anchorX - boxW / 2;
  else if (align === "right") boxX = anchorX - boxW;

  const textY = anchorY + pad;
  let textX = anchorX + pad;
  let textAnchor: "start" | "middle" | "end" = "start";
  if (align === "center") {
    textX = anchorX;
    textAnchor = "middle";
  } else if (align === "right") {
    textX = anchorX - pad;
    textAnchor = "end";
  }

  return { boxX, boxY: anchorY, boxW, boxH, textX, textY, textAnchor, lineHeight };
}
