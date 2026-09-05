import sharp from "sharp";

export type MemeCaptionOverlayOpts = {
  image: Buffer;
  topText?: string;
  bottomText?: string;
  textStyle?: string;
};

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapCaptionLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= maxCharsPerLine) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word.length > maxCharsPerLine ? word.slice(0, maxCharsPerLine) : word;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function fontFamilyForStyle(textStyle?: string): string {
  switch (textStyle) {
    case "helvetica-bold":
      return "Helvetica, Arial, sans-serif";
    case "comic-sans":
      return "'Comic Sans MS', cursive, sans-serif";
    default:
      return "Impact, 'Arial Black', sans-serif";
  }
}

function buildCaptionSvg(opts: {
  width: number;
  height: number;
  topText?: string;
  bottomText?: string;
  textStyle?: string;
}): string {
  const { width, height } = opts;
  const fontSize = Math.max(28, Math.round(width * 0.07));
  const lineHeight = Math.round(fontSize * 1.15);
  const fontFamily = fontFamilyForStyle(opts.textStyle);
  const maxChars = Math.max(12, Math.floor(width / (fontSize * 0.45)));

  const topLines = opts.topText?.trim()
    ? wrapCaptionLines(opts.topText, maxChars)
    : [];
  const bottomLines = opts.bottomText?.trim()
    ? wrapCaptionLines(opts.bottomText, maxChars)
    : [];

  const textBlocks: string[] = [];

  if (topLines.length > 0) {
    const startY = Math.round(height * 0.06) + fontSize;
    topLines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      textBlocks.push(
        `<text x="50%" y="${y}" text-anchor="middle" class="meme-caption">${escapeXml(line)}</text>`,
      );
    });
  }

  if (bottomLines.length > 0) {
    const blockHeight = bottomLines.length * lineHeight;
    const startY = height - Math.round(height * 0.06) - blockHeight + fontSize;
    bottomLines.forEach((line, i) => {
      const y = startY + i * lineHeight;
      textBlocks.push(
        `<text x="50%" y="${y}" text-anchor="middle" class="meme-caption">${escapeXml(line)}</text>`,
      );
    });
  }

  if (textBlocks.length === 0) return "";

  return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .meme-caption {
      fill: #ffffff;
      font-size: ${fontSize}px;
      font-weight: 900;
      font-family: ${fontFamily};
      stroke: #000000;
      stroke-width: ${Math.max(3, Math.round(fontSize * 0.08))}px;
      paint-order: stroke fill;
      letter-spacing: 0.02em;
    }
  </style>
  ${textBlocks.join("\n  ")}
</svg>`;
}

/** 在梗图底图上叠加上下 Impact 风格字幕（Sharp + SVG） */
export async function applyMemeCaptionOverlay(
  opts: MemeCaptionOverlayOpts,
): Promise<Buffer> {
  const hasText =
    Boolean(opts.topText?.trim()) || Boolean(opts.bottomText?.trim());
  if (!hasText) return opts.image;

  const meta = await sharp(opts.image).metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;
  const svg = buildCaptionSvg({
    width,
    height,
    topText: opts.topText,
    bottomText: opts.bottomText,
    textStyle: opts.textStyle,
  });
  if (!svg) return opts.image;

  return sharp(opts.image)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
