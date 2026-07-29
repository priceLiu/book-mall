import sharp from "sharp";
import { gridSplitCellExtractRect } from "./grid-split-cell-extract";
import { CanvasProjectError } from "./canvas-project-service";
import { persistCanvasBufferToOss } from "./canvas-oss";

const MAX_BYTES = 30 * 1024 * 1024;

/** 服务端 · 宫格单元裁切并上传 OSS（绕过浏览器 CORS） */
export async function cropCanvasGridSplitCellToOss(args: {
  projectId: string;
  imageUrl: string;
  col: number;
  row: number;
  cols: number;
  rows: number;
}): Promise<string> {
  const cols = Math.max(1, Math.floor(args.cols));
  const rows = Math.max(1, Math.floor(args.rows));
  const col = Math.max(0, Math.min(cols - 1, Math.floor(args.col)));
  const row = Math.max(0, Math.min(rows - 1, Math.floor(args.row)));

  const res = await fetch(args.imageUrl, { method: "GET" });
  if (!res.ok) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      `无法下载原图：HTTP ${res.status}`,
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_BYTES) {
    throw new CanvasProjectError("INVALID_INPUT", "原图过大，无法裁切");
  }

  const meta = await sharp(buf).metadata();
  const width = meta.width ?? 1;
  const height = meta.height ?? 1;
  const { left, top, width: cellW, height: cellH } = gridSplitCellExtractRect(
    width,
    height,
    col,
    row,
    cols,
    rows,
  );

  const cropped = await sharp(buf)
    .extract({ left, top, width: cellW, height: cellH })
    .jpeg({ quality: 92 })
    .toBuffer();

  try {
    return await persistCanvasBufferToOss({
      buf: cropped,
      contentType: "image/jpeg",
      kind: "node-image",
      projectId: args.projectId,
      ext: "jpg",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new CanvasProjectError("UPSTREAM_ERROR", message, 502);
  }
}
