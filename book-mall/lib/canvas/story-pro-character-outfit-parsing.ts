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

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const r = await fetch(url, { method: "GET" });
  if (!r.ok) throw new Error(`无法下载图片：HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.byteLength > MAX_IMAGE_BYTES) {
    throw new Error("图片文件过大");
  }
  return buf;
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

  const { output } = await canvasGwImageParsing(userId, {
    imageUrl: fullBodyUrl,
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
