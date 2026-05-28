import sharp from "sharp";

import {
  persistCanvasKieResultToOss,
  uploadCanvasUserBuffer,
} from "@/lib/canvas/canvas-oss";
import { canvasGwImageParsing } from "@/lib/canvas/canvas-gateway-client";
import type { DashscopeParsingOutput } from "@/lib/gateway/dashscope-client";
import {
  normalizeStoryProCharacterKey,
  upsertStoryProCharacterAssetRef,
  type StoryProCharacterAssetRecord,
} from "@/lib/canvas/story-pro-character-asset-service";

const MAX_IMAGE_BYTES = 30 * 1024 * 1024;
/** 百炼 aitryon-parsing：400 < 最短边，最长边 < 7000（Gateway 报错原文） */
const PARSING_MIN_EDGE = 401;
const PARSING_HARD_MAX = 7000;
const PARSING_SAFE_MAX = 3200;
const PARSING_MIN_BYTES = 5 * 1024;
const PARSING_MAX_BYTES = 5 * 1024 * 1024;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`无法下载图片：HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("图片文件过大");
  }
  return buf;
}

function parsingDimensionsOk(w: number, h: number): boolean {
  const maxEdge = Math.max(w, h);
  const minEdge = Math.min(w, h);
  return maxEdge > 0 && maxEdge < PARSING_HARD_MAX && minEdge > 400;
}

/** 最短边不足 401 时：先等比放大；仍不足则留白边（避免拉成极长条） */
async function ensureMinParsingEdge(buf: Buffer): Promise<Buffer> {
  const meta = await sharp(buf).metadata();
  let w = meta.width ?? 0;
  let h = meta.height ?? 0;
  if (w < 1 || h < 1) {
    throw new Error("无法解析全身图尺寸");
  }

  let minEdge = Math.min(w, h);
  if (minEdge > 400) return buf;

  const scale = PARSING_MIN_EDGE / minEdge;
  let nw = Math.round(w * scale);
  let nh = Math.round(h * scale);
  if (Math.max(nw, nh) < PARSING_HARD_MAX) {
    return sharp(buf).resize(nw, nh).jpeg({ quality: 88 }).toBuffer();
  }

  const padW = Math.max(w, PARSING_MIN_EDGE);
  const padH = Math.max(h, PARSING_MIN_EDGE);
  const left = Math.floor((padW - w) / 2);
  const right = padW - w - left;
  const top = Math.floor((padH - h) / 2);
  const bottom = padH - h - top;
  return sharp(buf)
    .extend({
      left,
      right,
      top,
      bottom,
      background: { r: 245, g: 245, b: 245 },
    })
    .jpeg({ quality: 88 })
    .toBuffer();
}

/** 归一化为百炼分割可接受的 JPEG buffer（边长 + 体积） */
async function normalizeImageBufferForParsing(source: Buffer): Promise<Buffer> {
  let quality = 88;
  let buf = await sharp(source, { failOn: "none" })
    .rotate()
    .resize(PARSING_SAFE_MAX, PARSING_SAFE_MAX, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality })
    .toBuffer();

  buf = await ensureMinParsingEdge(buf);

  for (let attempt = 0; attempt < 6; attempt++) {
    const meta = await sharp(buf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;
    if (w < 1 || h < 1) {
      throw new Error("无法解析全身图尺寸");
    }

    const maxEdge = Math.max(w, h);
    const minEdge = Math.min(w, h);
    const dimsOk = parsingDimensionsOk(w, h);
    const sizeOk =
      buf.byteLength >= PARSING_MIN_BYTES &&
      buf.byteLength <= PARSING_MAX_BYTES;

    if (dimsOk && sizeOk) return buf;

    if (minEdge <= 400) {
      buf = await ensureMinParsingEdge(buf);
      continue;
    }

    if (maxEdge >= PARSING_HARD_MAX) {
      buf = await sharp(buf)
        .resize(PARSING_HARD_MAX - 1, PARSING_HARD_MAX - 1, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .toBuffer();
      buf = await ensureMinParsingEdge(buf);
      continue;
    }

    if (buf.byteLength > PARSING_MAX_BYTES) {
      quality = Math.max(55, quality - 12);
      buf = await sharp(buf).jpeg({ quality }).toBuffer();
      continue;
    }

    if (buf.byteLength < PARSING_MIN_BYTES) {
      quality = Math.min(95, quality + 8);
      buf = await sharp(buf).jpeg({ quality, mozjpeg: true }).toBuffer();
      continue;
    }

    break;
  }

  const meta = await sharp(buf).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const maxEdge = Math.max(w, h);
  const minEdge = Math.min(w, h);
  if (!parsingDimensionsOk(w, h)) {
    throw new Error(
      `全身图归一化后尺寸仍不符合百炼要求（${w}×${h}px；最短边须大于 400、最长边须小于 7000）`,
    );
  }
  if (buf.byteLength > PARSING_MAX_BYTES) {
    throw new Error("全身图归一化后仍超过 5MB，请换一张较小的全身图");
  }
  if (maxEdge >= PARSING_HARD_MAX || minEdge <= 400) {
    throw new Error(
      `全身图尺寸 ${w}×${h}px 不符合分割要求（400 < 短边 < 长边 < 7000）`,
    );
  }
  return buf;
}

/** 上传归一化图并校验公网 URL 可被拉取且尺寸合规 */
async function imageUrlForParsing(
  userId: string,
  sourceUrl: string,
): Promise<string> {
  const sourceBuf = await fetchImageBuffer(sourceUrl);
  const normalized = await normalizeImageBufferForParsing(sourceBuf);
  const parsingUrl = await uploadCanvasUserBuffer({
    buf: normalized,
    contentType: "image/jpeg",
    userId,
    ext: "jpg",
    preferBucketUrl: true,
  });

  const verifyBuf = await fetchImageBuffer(parsingUrl);
  const verifyMeta = await sharp(verifyBuf).metadata();
  const vw = verifyMeta.width ?? 0;
  const vh = verifyMeta.height ?? 0;
  if (!parsingDimensionsOk(vw, vh)) {
    throw new Error(
      `上传后的全身图尺寸不合规（${vw}×${vh}px；百炼要求最短边 > 400、最长边 < 7000）`,
    );
  }
  return parsingUrl;
}

function pickParsingResultUrls(output: DashscopeParsingOutput): string[] {
  const parsing = (output.parsing_img_url ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
  if (parsing.length) return parsing;
  return (output.crop_img_url ?? []).filter(
    (u): u is string => typeof u === "string" && /^https?:\/\//.test(u),
  );
}

/** 将上下装分割图竖向拼成一张（透明底 PNG） */
async function mergeOutfitSegmentBuffers(buffers: Buffer[]): Promise<Buffer> {
  if (!buffers.length) throw new Error("无可用分割图");
  if (buffers.length === 1) return buffers[0];

  const images = await Promise.all(
    buffers.map((buf) => sharp(buf).ensureAlpha().toBuffer({ resolveWithObject: true })),
  );
  const width = Math.max(...images.map((i) => i.info.width));
  const totalHeight = images.reduce((sum, i) => sum + i.info.height, 0);

  let top = 0;
  const composites = images.map(({ data, info }) => {
    const left = Math.max(0, Math.floor((width - info.width) / 2));
    const comp = { input: data, top, left };
    top += info.height;
    return comp;
  });

  return sharp({
    create: {
      width,
      height: totalHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

async function persistOutfitSegmentUrls(
  urls: string[],
  userId: string,
): Promise<string> {
  const buffers = await Promise.all(urls.map((u) => fetchImageBuffer(u)));
  const merged = await mergeOutfitSegmentBuffers(buffers);
  return uploadCanvasUserBuffer({
    buf: merged,
    contentType: "image/png",
    userId,
    ext: "png",
  });
}

export type ParseOutfitFromFullBodyResult = {
  asset: StoryProCharacterAssetRecord;
  outfitOssUrl: string;
  segments: number;
};

/**
 * 以全身槽图片为输入，经 Gateway 调用百炼 aitryon-parsing-v1，
 * 合并分割结果并覆盖写入「服装」槽。
 */
export async function parseOutfitFromFullBodyViaGateway(
  userId: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    fullBodyUrl: string;
    sourceTaskId?: string | null;
  },
): Promise<ParseOutfitFromFullBodyResult> {
  const characterKey = normalizeStoryProCharacterKey(args.characterKey);
  const fullBodyUrl = args.fullBodyUrl.trim();
  const displayName = args.displayName.trim();
  if (!characterKey || !displayName || !/^https?:\/\//.test(fullBodyUrl)) {
    throw new Error("characterKey、displayName、fullBodyUrl 无效");
  }

  const parsingUrl = await imageUrlForParsing(userId, fullBodyUrl);
  const { output } = await canvasGwImageParsing(userId, {
    imageUrl: parsingUrl,
    clothesType: ["upper", "lower"],
    clientPage: "canvas/story-pro/parse-outfit",
  });

  const segmentUrls = pickParsingResultUrls(output);
  if (!segmentUrls.length) {
    throw new Error("未识别到上装或下装，请换一张更清晰的全身图后重试");
  }

  let outfitOssUrl: string;
  try {
    outfitOssUrl = await persistOutfitSegmentUrls(segmentUrls, userId);
  } catch {
    const first = segmentUrls[0]!;
    outfitOssUrl = await persistCanvasKieResultToOss({
      ephemeralUrl: first,
      kind: "user-upload",
      userId,
    });
  }

  const asset = await upsertStoryProCharacterAssetRef(userId, {
    characterKey,
    displayName,
    projectId: args.projectId ?? null,
    kind: "outfit",
    ossUrl: outfitOssUrl,
    label: `${displayName} · 服装（AI 分割）`,
    sourceTaskId: args.sourceTaskId ?? null,
  });

  return {
    asset,
    outfitOssUrl,
    segments: segmentUrls.length,
  };
}
