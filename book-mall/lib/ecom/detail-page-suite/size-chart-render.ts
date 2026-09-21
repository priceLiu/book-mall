import sharp from "sharp";

import type { DetailPageSuiteSizeChartTable } from "./types";

const W = 750;
const HEADER_H = 44;
const ROW_H = 40;
const TITLE_H = 48;
const PAD = 24;
const FONT =
  "-apple-system, BlinkMacSystemFont, PingFang SC, Microsoft YaHei, sans-serif";

function svgTextContent(s: string): string {
  return `<![CDATA[${s.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

function colWidths(colCount: number): number[] {
  const inner = W - PAD * 2;
  const first = Math.round(inner * 0.12);
  const rest = colCount > 1 ? (inner - first) / (colCount - 1) : inner;
  return Array.from({ length: colCount }, (_, i) => (i === 0 ? first : rest));
}

export function buildSizeChartSvg(table: DetailPageSuiteSizeChartTable): string {
  const headers = table.headers.filter(Boolean);
  const rows = table.rows.filter((r) => r.some((c) => String(c).trim()));
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length), 1);
  const widths = colWidths(colCount);
  const tableW = widths.reduce((a, b) => a + b, 0);
  const tableH = HEADER_H + rows.length * ROW_H;
  const titleBlock = table.title?.trim() ? TITLE_H : 0;
  const H = PAD * 2 + titleBlock + tableH;

  let y = PAD;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`;
  svg += `<rect width="100%" height="100%" fill="#ffffff"/>`;

  if (table.title?.trim()) {
    svg += `<text x="${W / 2}" y="${y + 32}" text-anchor="middle" font-family="${FONT}" font-size="18" font-weight="600" fill="#1d1d1f">${svgTextContent(table.title.trim())}</text>`;
    y += titleBlock;
  }

  const x0 = (W - tableW) / 2;
  let x = x0;
  for (let c = 0; c < colCount; c++) {
    const w = widths[c] ?? 80;
    svg += `<rect x="${x}" y="${y}" width="${w}" height="${HEADER_H}" fill="#1d1d1f"/>`;
    const ht = headers[c]?.trim() ?? "";
    svg += `<text x="${x + w / 2}" y="${y + 28}" text-anchor="middle" font-family="${FONT}" font-size="14" font-weight="600" fill="#ffffff">${svgTextContent(ht)}</text>`;
    x += w;
  }
  y += HEADER_H;

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    x = x0;
    const bg = r % 2 === 0 ? "#ffffff" : "#f5f5f7";
    for (let c = 0; c < colCount; c++) {
      const w = widths[c] ?? 80;
      svg += `<rect x="${x}" y="${y}" width="${w}" height="${ROW_H}" fill="${bg}" stroke="#e8e8ed" stroke-width="1"/>`;
      const cell = String(row[c] ?? "").trim();
      svg += `<text x="${x + w / 2}" y="${y + 26}" text-anchor="middle" font-family="${FONT}" font-size="13" fill="#1d1d1f">${svgTextContent(cell)}</text>`;
      x += w;
    }
    y += ROW_H;
  }

  svg += "</svg>";
  return svg;
}

export async function renderSizeChartPng(table: DetailPageSuiteSizeChartTable): Promise<Buffer> {
  const svg = buildSizeChartSvg(table);
  return sharp(Buffer.from(svg)).png().toBuffer();
}
