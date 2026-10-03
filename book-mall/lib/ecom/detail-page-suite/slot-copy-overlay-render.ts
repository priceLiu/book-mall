import sharp from "sharp";

import type { EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";
import {
  composeOverlayTextLines,
  layerSvgEffectFilterAttr,
  layerSvgEffectFilterDef,
  layerSvgStrokeAttrs,
  overlayLineHeightPx,
  resolveHorizontalTextBoxLayout,
  resolveLayerFontSvg,
  resolveLayerTextBg,
} from "@private/ecom-copy-overlay";

function svgTextContent(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function svgTextBackgroundRectFromBox(
  layer: EcomCopyOverlayLayer,
  boxX: number,
  boxY: number,
  boxW: number,
  boxH: number,
): string {
  const bg = resolveLayerTextBg(layer);
  if (!bg) return "";
  return `<rect x="${boxX}" y="${boxY}" width="${boxW}" height="${boxH}" rx="${bg.radiusPx}" fill="${bg.color}" fill-opacity="${bg.opacity}"/>`;
}

function layerSvgHorizontalFixed(
  layer: EcomCopyOverlayLayer,
  canvasW: number,
  _canvasH: number,
  filterId?: string,
): string {
  const maxW = Math.max(40, (layer.maxWidthNorm ?? 0.88) * canvasW);
  const bold = layer.fontWeight !== "normal";
  const lines = composeOverlayTextLines(layer.text, layer.fontSize, bold, maxW);
  const layout = resolveHorizontalTextBoxLayout(layer, canvasW, _canvasH, lines, maxW);
  const weight = layer.fontWeight === "normal" ? "400" : "700";
  const color = layer.color?.trim() || "#ffffff";
  const filterAttr =
    filterId != null ? layerSvgEffectFilterAttr(layer, filterId) : "";
  const strokeAttr = layerSvgStrokeAttrs(layer);
  const font = resolveLayerFontSvg(layer);
  const bg = resolveLayerTextBg(layer);
  const bgRect = svgTextBackgroundRectFromBox(
    layer,
    layout.boxX,
    layout.boxY,
    layout.boxW,
    layout.boxH,
  );
  const nonEmptyLines = lines.filter((l) => l.length > 0);
  const singleLineInBg = Boolean(bg && nonEmptyLines.length === 1);
  const textY = singleLineInBg ? layout.boxY + layout.boxH / 2 : layout.textY;
  const baselineAttr = singleLineInBg
    ? ' dominant-baseline="central"'
    : ' dominant-baseline="text-before-edge"';
  let svg = bgRect;
  svg += `<text x="${layout.textX}" y="${textY}"${baselineAttr} text-anchor="${layout.textAnchor}" font-family="${font}" font-size="${layer.fontSize}" font-weight="${weight}" fill="${color}"${strokeAttr}${filterAttr}>`;
  const lineStep = bg ? overlayLineHeightPx(layer) : layout.lineHeight;
  lines.forEach((line, i) => {
    const x = layout.textAnchor === "middle" ? layout.textX : layout.textX;
    svg += `<tspan x="${x}" dy="${i === 0 ? 0 : lineStep}">${svgTextContent(line)}</tspan>`;
  });
  svg += "</text>";
  return svg;
}

function layerSvgVertical(
  layer: EcomCopyOverlayLayer,
  canvasW: number,
  canvasH: number,
  filterId?: string,
): string {
  const colMaxH = Math.max(
    layer.fontSize * 2,
    (layer.maxHeightNorm ?? 0.55) * canvasH,
  );
  const charsPerCol = Math.max(1, Math.floor(colMaxH / (layer.fontSize * 1.15)));
  const paragraphs = layer.text.split(/\n/).map((p) => p.trim()).filter(Boolean);
  const columns: string[][] = [];
  for (const para of paragraphs.length ? paragraphs : [layer.text.trim()]) {
    const chars = [...para.replace(/\s/g, "")];
    for (let i = 0; i < chars.length; i += charsPerCol) {
      columns.push(chars.slice(i, i + charsPerCol));
    }
  }
  if (columns.length === 0) columns.push([...layer.text.trim()]);

  const maxColsW = (layer.maxWidthNorm ?? 0.88) * canvasW;
  const colStep = layer.fontSize * 1.35;
  const maxCols = Math.max(1, Math.floor(maxColsW / colStep));
  const usedCols = columns.slice(0, maxCols);

  const anchorX = layer.nx * canvasW;
  const anchorY = layer.ny * canvasH;
  const weight = layer.fontWeight === "normal" ? "400" : "700";
  const color = layer.color?.trim() || "#ffffff";
  const lineGap = layer.fontSize * 1.15;
  const filterAttr =
    filterId != null ? layerSvgEffectFilterAttr(layer, filterId) : "";
  const strokeAttr = layerSvgStrokeAttrs(layer);
  const font = resolveLayerFontSvg(layer);
  const bg = resolveLayerTextBg(layer);
  const pad = bg?.paddingPx ?? 0;

  let svg = "";
  usedCols.forEach((col, colIndex) => {
    const x =
      layer.textAlign === "right"
        ? anchorX - colIndex * colStep
        : layer.textAlign === "left"
          ? anchorX + colIndex * colStep
          : anchorX + (colIndex - (usedCols.length - 1) / 2) * colStep;
    const colH = col.length * lineGap;
    const colW = layer.fontSize * 1.05;
    if (bg) {
      svg += `<rect x="${x - colW / 2 - pad}" y="${anchorY - pad}" width="${colW + pad * 2}" height="${colH + pad * 2}" rx="${bg.radiusPx}" fill="${bg.color}" fill-opacity="${bg.opacity}"/>`;
    }
    const textY = anchorY + pad;
    let block = `<text x="${x}" y="${textY}" dominant-baseline="hanging" text-anchor="middle" font-family="${font}" font-size="${layer.fontSize}" font-weight="${weight}" fill="${color}"${strokeAttr}${filterAttr}>`;
    col.forEach((ch, i) => {
      const dy = i === 0 ? 0 : lineGap;
      block += `<tspan x="${x}" dy="${dy}px">${svgTextContent(ch)}</tspan>`;
    });
    block += "</text>";
    svg += block;
  });
  return svg;
}

function layerSvgLines(
  layer: EcomCopyOverlayLayer,
  canvasW: number,
  canvasH: number,
  filterId?: string,
): string {
  if (layer.writingMode === "vertical") {
    return layerSvgVertical(layer, canvasW, canvasH, filterId);
  }
  return layerSvgHorizontalFixed(layer, canvasW, canvasH, filterId);
}

export function buildSlotCopyOverlaySvg(
  width: number,
  height: number,
  layers: EcomCopyOverlayLayer[],
): string {
  const visible = layers.filter((l) => l.text.trim());
  let defs = "";
  const body = visible
    .map((l, i) => {
      const filterId = `layer-fx-${i}`;
      defs += layerSvgEffectFilterDef(l, filterId);
      return layerSvgLines(l, width, height, filterId);
    })
    .join("");
  const defsBlock = defs ? `<defs>${defs}</defs>` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${defsBlock}${body}</svg>`;
}

export async function compositeBaseImageWithCopyOverlay(opts: {
  baseImage: Buffer;
  exportWidthPx: number;
  layers: EcomCopyOverlayLayer[];
}): Promise<Buffer> {
  const meta = await sharp(opts.baseImage).metadata();
  const srcW = meta.width ?? opts.exportWidthPx;
  const srcH = meta.height ?? opts.exportWidthPx;
  const outW = opts.exportWidthPx;
  const outH = Math.max(1, Math.round((srcH / srcW) * outW));
  const base = await sharp(opts.baseImage).resize(outW, outH).png().toBuffer();
  if (!opts.layers.some((l) => l.text.trim())) {
    return base;
  }
  const svg = buildSlotCopyOverlaySvg(outW, outH, opts.layers);
  const overlayPng = await sharp(Buffer.from(svg)).png().toBuffer();
  return sharp(base)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .png()
    .toBuffer();
}
