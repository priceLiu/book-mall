import sharp from "sharp";
import { gridSplitCellExtractRect } from "./grid-split-cell-extract";
import { CanvasProjectError } from "./canvas-project-service";
import { buildCanvasOssKey } from "./canvas-constants";
import { readOssEnv, ossUploadBuffer } from "@/lib/oss-client";

const MAX_BYTES = 30 * 1024 * 1024;

function virtualHostedPublicUrl(
  cfg: { bucket: string; region: string },
  key: string,
): string {
  const base = process.env.OSS_PUBLIC_URL_BASE?.trim().replace(/\/$/, "");
  if (base) return `${base}/${key}`;
  return `https://${cfg.bucket}.${cfg.region}.aliyuncs.com/${key}`;
}

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

  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) {
    throw new CanvasProjectError("INTERNAL", cfgRaw.error);
  }
  const key = buildCanvasOssKey("node-image", {
    projectId: args.projectId,
    ext: "jpg",
  });
  await ossUploadBuffer({
    cfg: cfgRaw,
    key,
    buf: cropped,
    contentType: "image/jpeg",
  });
  return virtualHostedPublicUrl(cfgRaw, key);
}
