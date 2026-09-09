import { ensureDashscopeImageUrl } from "@/lib/ecom/ecom-dashscope-image-normalize";
import { ensureVtonParsingImageUrl } from "@/lib/ecom/ecom-vton/parsing-image-normalize";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import type { DashscopeClothesType, DashscopeParsingOutput } from "@/lib/gateway/dashscope-client";
import { ecomGwImageParsing } from "@/lib/gateway/ecom-tool-gateway-client";

export type VtonGarmentParseCache = Map<string, string>;

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

/** 套装参考图分割：优先 parsing（平铺/抠图），crop 常为「穿着该件的模特局部」不适合作服饰槽 */
function pickGarmentPieceUrlForTryon(output: DashscopeParsingOutput, index: number): string | null {
  const parsing = output.parsing_img_url?.[index];
  if (typeof parsing === "string" && parsing.trim()) return parsing.trim();
  return pickGarmentCropUrlAtIndex(output, index);
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

  opts.cache?.set(key, cropUrl);
  return cropUrl;
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

  const pieceUrl = pickGarmentPieceUrlForTryon(output, 0);
  if (!pieceUrl) {
    throw new Error(
      `未能从套装图识别${CLOTHES_LABEL[opts.clothesType]}，请换一张上下装完整、背景简洁的套装参考图`,
    );
  }

  const persisted = await ensureDashscopeImageUrl({ userId: opts.userId, imageUrl: pieceUrl });
  opts.cache?.set(key, persisted.url);
  return persisted.url;
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

  const [topGarmentUrl, bottomGarmentUrl] = await Promise.all([
    parseVtonOutfitPieceFromGarmentImage({ ...shared, clothesType: "upper" }),
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
