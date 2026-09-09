import { ensureDashscopeImageUrl } from "@/lib/ecom/ecom-dashscope-image-normalize";
import {
  assessVtonGarmentUrlQuality,
  normalizeVtonGarmentCropUrl,
  tightenVtonGarmentUrlIfNeeded,
} from "@/lib/ecom/ecom-vton/garment-crop-normalize";
import { ensureVtonParsingImageUrl } from "@/lib/ecom/ecom-vton/parsing-image-normalize";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import type { DashscopeClothesType, DashscopeParsingOutput } from "@/lib/gateway/dashscope-client";
import { ecomGwImageParsing } from "@/lib/gateway/ecom-tool-gateway-client";

export type VtonGarmentParseCache = Map<string, string>;

const fullSetParseInflight = new Map<
  string,
  Promise<{ topGarmentUrl: string; bottomGarmentUrl: string }>
>();

async function parsedGarmentUrlsNeedReparse(topUrl: string, bottomUrl: string): Promise<boolean> {
  const [topQ, bottomQ] = await Promise.all([
    assessVtonGarmentUrlQuality(topUrl),
    assessVtonGarmentUrlQuality(bottomUrl),
  ]);
  if (topQ.needsTightening || topQ.fillRatio < 0.22) return true;
  if (bottomQ.needsTightening || bottomQ.fillRatio < 0.15) return true;
  return false;
}

function parseCacheKey(personImageUrl: string, clothesType: DashscopeClothesType): string {
  return `${personImageUrl.trim()}::${clothesType}`;
}

function pickGarmentCropUrlAtIndex(output: DashscopeParsingOutput, index: number): string | null {
  const crop = output.crop_img_url?.[index];
  if (typeof crop === "string" && crop.trim()) return crop.trim();
  const parsing = output.parsing_img_url?.[index];
  if (typeof parsing === "string" && parsing.trim()) return parsing.trim();
  return null;
}

type ParsedGarmentPiece = {
  url: string;
  centerY: number;
  source: "crop" | "parsing";
  bbox: number[] | null;
};

function bboxCenterY(bbox: number[] | null | undefined): number | null {
  if (!bbox || bbox.length < 4) return null;
  const y1 = bbox[1];
  const y2 = bbox[3];
  if (typeof y1 !== "number" || typeof y2 !== "number") return null;
  return (y1 + y2) / 2;
}

function collectParsedGarmentPieces(output: DashscopeParsingOutput): ParsedGarmentPiece[] {
  const maxLen = Math.max(
    output.crop_img_url?.length ?? 0,
    output.parsing_img_url?.length ?? 0,
    output.bbox?.length ?? 0,
  );
  const pieces: ParsedGarmentPiece[] = [];
  for (let i = 0; i < maxLen; i++) {
    const crop = output.crop_img_url?.[i];
    const parsing = output.parsing_img_url?.[i];
    const bbox = output.bbox?.[i] ?? null;
    const centerY = bboxCenterY(bbox) ?? i;
    if (typeof crop === "string" && crop.trim()) {
      pieces.push({ url: crop.trim(), centerY, source: "crop", bbox });
    } else if (typeof parsing === "string" && parsing.trim()) {
      pieces.push({ url: parsing.trim(), centerY, source: "parsing", bbox });
    }
  }
  return pieces;
}

/** 从一次 upper+lower 联合分割结果中拆出上装/下装 URL（按 bbox 纵向位置排序） */
export function pickFullSetGarmentPiecesFromOutput(
  output: DashscopeParsingOutput,
): {
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  topBbox?: number[] | null;
  bottomBbox?: number[] | null;
} {
  const pieces = collectParsedGarmentPieces(output);
  if (pieces.length >= 2) {
    const sorted = [...pieces].sort((a, b) => a.centerY - b.centerY);
    return {
      topGarmentUrl: sorted[0]!.url,
      topBbox: sorted[0]!.bbox,
      bottomGarmentUrl: sorted[sorted.length - 1]!.url,
      bottomBbox: sorted[sorted.length - 1]!.bbox,
    };
  }
  if (pieces.length === 1) {
    return { topGarmentUrl: pieces[0]!.url, topBbox: pieces[0]!.bbox };
  }
  return {};
}

async function persistParsedGarmentCropUrl(opts: {
  userId: string;
  vendorCropUrl: string;
  bbox?: number[] | null;
  sourceImageUrl?: string;
}): Promise<string> {
  const normalized = await normalizeVtonGarmentCropUrl(opts);
  const persisted = await ensureDashscopeImageUrl({ userId: opts.userId, imageUrl: normalized });
  return persisted.url;
}

function pickFullSetGarmentPieceUrl(output: DashscopeParsingOutput, index: number): string | null {
  const crop = output.crop_img_url?.[index];
  if (typeof crop === "string" && crop.trim()) return crop.trim();
  const parsing = output.parsing_img_url?.[index];
  if (typeof parsing === "string" && parsing.trim()) return parsing.trim();
  return null;
}

function pickGarmentCropUrl(
  output: DashscopeParsingOutput,
  clothesType: DashscopeClothesType,
): string | null {
  return pickGarmentCropUrlAtIndex(output, 0);
}

const CLOTHES_LABEL: Record<"upper" | "lower", string> = {
  upper: "上装",
  lower: "下装",
};

/**
 * 从模特全身图分割出原穿搭的上装或下装（crop），供 aitryon-plus「保留原搭配」试衣。
 * @see https://help.aliyun.com/zh/model-studio/aitryon-plus-api
 */
export async function parseVtonGarmentFromPersonImage(opts: {
  userId: string;
  personImageUrl: string;
  clothesType: "upper" | "lower";
  projectId: string;
  consumerToolKey: string;
  cache?: VtonGarmentParseCache;
}): Promise<string> {
  const personImageUrl = opts.personImageUrl.trim();
  if (!personImageUrl) throw new Error("缺少模特全身照");

  const key = parseCacheKey(personImageUrl, opts.clothesType);
  const cached = opts.cache?.get(key);
  if (cached) return cached;

  const parsingUrl = await ensureVtonParsingImageUrl(opts.userId, personImageUrl);
  const clientPage = `${ecomClientPage(opts.userId, opts.projectId, opts.consumerToolKey)}/garment-parse`;
  const { output } = await ecomGwImageParsing(opts.userId, {
    imageUrl: parsingUrl,
    clothesType: [opts.clothesType],
    clientPage,
  });

  const cropUrl = pickGarmentCropUrl(output, opts.clothesType);
  if (!cropUrl) {
    throw new Error(
      `未能从模特图识别原${CLOTHES_LABEL[opts.clothesType]}，请换一张 T 恤+长裤的清晰全身底图后重试`,
    );
  }

  const persisted = await persistParsedGarmentCropUrl({
    userId: opts.userId,
    vendorCropUrl: cropUrl,
    bbox: output.bbox?.[0] ?? null,
    sourceImageUrl: parsingUrl,
  });
  opts.cache?.set(key, persisted);
  return persisted;
}

type FullSetParseCacheValue = { topGarmentUrl: string; bottomGarmentUrl: string };

function fullSetParseCacheKey(garmentImageUrl: string): string {
  return `${garmentImageUrl.trim()}::full_set`;
}

function garmentPieceCacheKey(garmentImageUrl: string, clothesType: "upper" | "lower"): string {
  return `${garmentImageUrl.trim()}::garment::${clothesType}`;
}

/** 从套装/穿搭参考图分割单件上装或下装 crop（非模特底图）。 */
async function parseVtonOutfitPieceFromGarmentImage(opts: {
  userId: string;
  garmentImageUrl: string;
  clothesType: "upper" | "lower";
  projectId: string;
  consumerToolKey: string;
  parsingUrl: string;
  cache?: VtonGarmentParseCache;
}): Promise<string> {
  const key = garmentPieceCacheKey(opts.garmentImageUrl, opts.clothesType);
  const cached = opts.cache?.get(key);
  if (cached) return cached;

  const clientPage = `${ecomClientPage(opts.userId, opts.projectId, opts.consumerToolKey)}/garment-parse-${opts.clothesType}`;
  const { output } = await ecomGwImageParsing(opts.userId, {
    imageUrl: opts.parsingUrl,
    clothesType: [opts.clothesType],
    clientPage,
  });

  const pieceUrl = pickFullSetGarmentPieceUrl(output, 0);
  if (!pieceUrl) {
    throw new Error(
      `未能从套装图识别${CLOTHES_LABEL[opts.clothesType]}，请换一张上下装完整、背景简洁的套装参考图`,
    );
  }

  const persisted = await persistParsedGarmentCropUrl({
    userId: opts.userId,
    vendorCropUrl: pieceUrl,
    bbox: output.bbox?.[0] ?? null,
    sourceImageUrl: opts.parsingUrl,
  });
  opts.cache?.set(key, persisted);
  return persisted;
}

async function parseFullSetPiecesCombined(opts: {
  userId: string;
  garmentImageUrl: string;
  projectId: string;
  consumerToolKey: string;
  parsingUrl: string;
}): Promise<{ topGarmentUrl?: string; bottomGarmentUrl?: string }> {
  const clientPage = `${ecomClientPage(opts.userId, opts.projectId, opts.consumerToolKey)}/garment-parse-full-set`;
  const { output } = await ecomGwImageParsing(opts.userId, {
    imageUrl: opts.parsingUrl,
    clothesType: ["upper", "lower"],
    clientPage,
  });

  const picked = pickFullSetGarmentPiecesFromOutput(output);
  const topRaw = picked.topGarmentUrl ?? pickFullSetGarmentPieceUrl(output, 0);
  const bottomRaw = picked.bottomGarmentUrl ?? pickFullSetGarmentPieceUrl(output, 1);
  const [topNorm, bottomNorm] = await Promise.all([
    topRaw
      ? persistParsedGarmentCropUrl({
          userId: opts.userId,
          vendorCropUrl: topRaw,
          bbox: picked.topBbox ?? output.bbox?.[0] ?? null,
          sourceImageUrl: opts.parsingUrl,
        })
      : Promise.resolve(null),
    bottomRaw
      ? persistParsedGarmentCropUrl({
          userId: opts.userId,
          vendorCropUrl: bottomRaw,
          bbox: picked.bottomBbox ?? output.bbox?.[1] ?? null,
          sourceImageUrl: opts.parsingUrl,
        })
      : Promise.resolve(null),
  ]);
  return {
    topGarmentUrl: topNorm ?? undefined,
    bottomGarmentUrl: bottomNorm ?? undefined,
  };
}

/**
 * 从套装参考图（含上下装）分割出上装与下装 crop，供 aitryon 双槽试衣。
 * 上下装各调一次分割 API，比单次 ["upper","lower"] 更稳定。
 */
export async function parseVtonFullSetGarmentFromImage(opts: {
  userId: string;
  garmentImageUrl: string;
  projectId: string;
  consumerToolKey: string;
  cache?: VtonGarmentParseCache;
}): Promise<{ topGarmentUrl: string; bottomGarmentUrl: string }> {
  const garmentImageUrl = opts.garmentImageUrl.trim();
  if (!garmentImageUrl) throw new Error("缺少套装参考图");

  const key = fullSetParseCacheKey(garmentImageUrl);
  const cached = opts.cache?.get(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached) as FullSetParseCacheValue;
      if (parsed.topGarmentUrl && parsed.bottomGarmentUrl) return parsed;
    } catch {
      /* 重新分割 */
    }
  }

  const parsingUrl = await ensureVtonParsingImageUrl(opts.userId, garmentImageUrl);
  const shared = {
    userId: opts.userId,
    garmentImageUrl,
    projectId: opts.projectId,
    consumerToolKey: opts.consumerToolKey,
    parsingUrl,
    cache: opts.cache,
  };

  const combined = await parseFullSetPiecesCombined({
    userId: opts.userId,
    garmentImageUrl,
    projectId: opts.projectId,
    consumerToolKey: opts.consumerToolKey,
    parsingUrl,
  });

  const [topGarmentUrl, bottomGarmentUrl] = await Promise.all([
    combined.topGarmentUrl ??
      parseVtonOutfitPieceFromGarmentImage({ ...shared, clothesType: "upper" }),
    combined.bottomGarmentUrl ??
      parseVtonOutfitPieceFromGarmentImage({ ...shared, clothesType: "lower" }),
  ]);

  if (topGarmentUrl === bottomGarmentUrl) {
    throw new Error("套装分割异常（上下装识别为同一张图），请换一张上下装更清晰的套装参考图");
  }

  opts.cache?.set(
    key,
    JSON.stringify({ topGarmentUrl, bottomGarmentUrl } satisfies FullSetParseCacheValue),
  );
  return { topGarmentUrl, bottomGarmentUrl };
}

/** 套装池条目：确保已有预分割上下装 URL（上传时或试衣前补跑） */
export async function ensureFullSetGarmentParsed(opts: {
  userId: string;
  garment: { ossUrl: string; parsedTopUrl?: string; parsedBottomUrl?: string };
  projectId: string;
  consumerToolKey: string;
  cache?: VtonGarmentParseCache;
}): Promise<{ topGarmentUrl: string; bottomGarmentUrl: string }> {
  const compositeUrl = opts.garment.ossUrl.trim();
  if (!compositeUrl) throw new Error("缺少套装参考图");

  const top = opts.garment.parsedTopUrl?.trim();
  const bottom = opts.garment.parsedBottomUrl?.trim();
  if (top && bottom) {
    const shouldReparse = await parsedGarmentUrlsNeedReparse(top, bottom);
    if (!shouldReparse) {
      const [topGarmentUrl, bottomGarmentUrl] = await Promise.all([
        tightenVtonGarmentUrlIfNeeded({ userId: opts.userId, garmentUrl: top }),
        tightenVtonGarmentUrlIfNeeded({ userId: opts.userId, garmentUrl: bottom }),
      ]);
      return { topGarmentUrl, bottomGarmentUrl };
    }
    opts.cache?.delete(fullSetParseCacheKey(compositeUrl));
  }

  const inflight = fullSetParseInflight.get(compositeUrl);
  if (inflight) return inflight;

  const job = parseVtonFullSetGarmentFromImage({
    userId: opts.userId,
    garmentImageUrl: compositeUrl,
    projectId: opts.projectId,
    consumerToolKey: opts.consumerToolKey,
    cache: opts.cache,
  }).finally(() => {
    fullSetParseInflight.delete(compositeUrl);
  });
  fullSetParseInflight.set(compositeUrl, job);
  return job;
}
