import sharp from "sharp";

import type { EcomCopyOverlayLayer } from "@private/ecom-copy-overlay";

const FONT =
  "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif";

function svgTextContent(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function wrapLines(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const p = paragraph.trim();
    if (!p) {
      lines.push("");
      continue;
    }
    let rest = p;
    while (rest.length > maxCharsPerLine) {
      lines.push(rest.slice(0, maxCharsPerLine));
      rest = rest.slice(maxCharsPerLine);
    }
    lines.push(rest);
  }
  return lines.length ? lines : [""];
}

function layerSvgHorizontalFixed(
  layer: EcomCopyOverlayLayer,
  canvasW: number,
  canvasH: number,
): string {
  const maxW = Math.max(40, (layer.maxWidthNorm ?? 0.88) * canvasW);
  const approxCharW = layer.fontSize * 1.02;
  const maxChars = Math.max(4, Math.floor(maxW / approxCharW));
  const lines = wrapLines(layer.text, maxChars);
  const anchorX = layer.nx * canvasW;
  const anchorY = layer.ny * canvasH;
  const anchor =
    layer.textAlign === "left"
      ? "start"
      : layer.textAlign === "right"
        ? "end"
        : "middle";
  const weight = layer.fontWeight === "normal" ? "400" : "700";
  const color = layer.color?.trim() || "#ffffff";
  const lineHeight = layer.fontSize * 1.25;
  let svg = `<text x="${anchorX}" y="${anchorY}" dominant-baseline="hanging" text-anchor="${anchor}" font-family="${FONT}" font-size="${layer.fontSize}" font-weight="${weight}" fill="${color}">`;
  lines.forEach((line, i) => {
    svg += `<tspan x="${anchorX}" dy="${i === 0 ? 0 : lineHeight}">${svgTextContent(line)}</tspan>`;
  });
  svg += "</text>";
  return svg;
}

function layerSvgVertical(
  layer: EcomCopyOverlayLayer,
  canvasW: number,
  canvasH: number,
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

  let svg = "";
  usedCols.forEach((col, colIndex) => {
    const x =
      layer.textAlign === "right"
        ? anchorX - colIndex * colStep
        : layer.textAlign === "left"
          ? anchorX + colIndex * colStep
          : anchorX + (colIndex - (usedCols.length - 1) / 2) * colStep;
    let block = `<text x="${x}" y="${anchorY}" dominant-baseline="hanging" text-anchor="middle" font-family="${FONT}" font-size="${layer.fontSize}" font-weight="${weight}" fill="${color}">`;
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
): string {
  if (layer.writingMode === "vertical") {
    return layerSvgVertical(layer, canvasW, canvasH);
  }
  return layerSvgHorizontalFixed(layer, canvasW, canvasH);
}

export function buildSlotCopyOverlaySvg(
  width: number,
  height: number,
  layers: EcomCopyOverlayLayer[],
): string {
  const body = layers
    .filter((l) => l.text.trim())
    .map((l) => layerSvgLines(l, width, height))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
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
