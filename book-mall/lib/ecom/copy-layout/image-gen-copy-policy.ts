import {
  buildHitDetailPageImagePrompt,
  mergeHitDetailPageImageNegativePrompt,
} from "@/lib/ecom/detail-page-suite-hit/hit-image-prompt";
import { DETAIL_PAGE_SUITE_NEGATIVE_PROMPT } from "@/lib/ecom/detail-page-suite/types";

const ECOM_POSTER_NO_TEXT_NEGATIVE_EXTRA =
  "文字，标题，水印，logo，标语，价格标签，乱码，密集小字";

export type CopyImageGenProfile = "detail-hit" | "ecom-poster";

export type CopyAwareImageGenPlan = {
  promptForModel: string;
  negativePrompt: string;
  burnCopyInImage: boolean;
};

export function buildCopyAwareImageGenPlan(opts: {
  profile: CopyImageGenProfile;
  basePositivePrompt: string;
  slotCopy?: string;
  burnCopyInImage: boolean;
  slotNegative?: string;
}): CopyAwareImageGenPlan {
  const base = opts.basePositivePrompt.trim();
  const copy = opts.slotCopy?.trim() ?? "";
  const burn = opts.burnCopyInImage && Boolean(copy);

  if (opts.profile === "detail-hit") {
    const promptForModel = buildHitDetailPageImagePrompt({
      positivePrompt: base,
      slotCopy: copy,
      includeSlotCopyOnImage: burn,
    });
    return {
      promptForModel,
      negativePrompt: mergeHitDetailPageImageNegativePrompt(opts.slotNegative, burn),
      burnCopyInImage: burn,
    };
  }

  let promptForModel = base;
  if (burn && copy) {
    promptForModel = [
      base,
      "",
      "在画面留白区用电商营销海报风格展示以下文案，逐字一致，禁止其它叠加文字：",
      `「${copy.slice(0, 48)}」`,
    ].join("\n");
  } else {
    promptForModel = [
      base,
      "",
      "【无字摄影画面】禁止任何可读文字、水印、价签、logo 叠加；为后续程序排版保留标题留白区。",
    ].join("\n");
  }

  const negativeBase = burn
    ? DETAIL_PAGE_SUITE_NEGATIVE_PROMPT.replace(/文字，/, "")
    : `${DETAIL_PAGE_SUITE_NEGATIVE_PROMPT}，${ECOM_POSTER_NO_TEXT_NEGATIVE_EXTRA}`;
  const extra = opts.slotNegative?.trim();
  const negativePrompt = extra ? `${negativeBase}，${extra}` : negativeBase;

  return { promptForModel, negativePrompt, burnCopyInImage: burn };
}
