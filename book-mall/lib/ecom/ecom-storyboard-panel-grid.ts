import sharp from "sharp";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";

function gridShape(count: number): { cols: number; rows: number } {
  if (count <= 3) return { cols: count, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: Math.ceil(count / 3) };
}

/**
 * 将各镜头分镜图拼成「纯画面宫格」，供百炼 R2V / 火山等视频模型作故事板参考。
 * 不含表格、文字、参考图区——模型无法可靠解析 HTML 表格截图。
 */
export async function composeStoryboardPanelGridPng(opts: {
  userId: string;
  panelUrls: string[];
  aspectRatio?: "16:9" | "9:16";
}): Promise<string> {
  const panelUrls = opts.panelUrls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  if (!panelUrls.length) {
    throw new Error("无分镜图可合成宫格");
  }

  const ar = opts.aspectRatio === "16:9" ? "16:9" : "9:16";
  const cellW = ar === "9:16" ? 360 : 640;
  const cellH = ar === "9:16" ? 640 : 360;
  const gap = 8;
  const pad = 16;

  const cells: Buffer[] = [];
  for (const url of panelUrls) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`下载分镜图失败 HTTP ${res.status}`);
    }
    const input = Buffer.from(await res.arrayBuffer());
    const cell = await sharp(input)
      .resize(cellW, cellH, { fit: "cover", position: "centre" })
      .png()
      .toBuffer();
    cells.push(cell);
  }

  const { cols, rows } = gridShape(panelUrls.length);
  const canvasW = cols * cellW + (cols - 1) * gap + pad * 2;
  const canvasH = rows * cellH + (rows - 1) * gap + pad * 2;

  const overlays: Array<{ input: Buffer; left: number; top: number }> = [];
  for (let i = 0; i < cells.length; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cellsInRow =
      row === rows - 1 ? Math.min(cols, panelUrls.length - row * cols) : cols;
    const rowOffset =
      cellsInRow < cols
        ? Math.floor(((cols - cellsInRow) * (cellW + gap)) / 2)
        : 0;
    overlays.push({
      input: cells[i]!,
      left: pad + rowOffset + col * (cellW + gap),
      top: pad + row * (cellH + gap),
    });
  }

  const out = await sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite(overlays)
    .png()
    .toBuffer();

  return uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: "png",
    buf: out,
    contentType: "image/png",
  });
}
