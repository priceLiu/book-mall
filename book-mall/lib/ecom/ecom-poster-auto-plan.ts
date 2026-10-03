import { createDefaultArtifact } from "@private/ecom-copy-overlay";

import { buildMarketingPosterScenePrompt } from "@/lib/ecom/ecom-image-processing-presets";
import { getPosterFestivalPack } from "@/lib/ecom/ecom-poster-festival-packs";
import type {
  PosterAutoPlan,
  PosterEasyPath,
  PosterReference,
} from "@/lib/ecom/ecom-poster-types";
import { exportWidthForAspect } from "@/lib/ecom/ecom-poster-types";

export function buildPosterAutoPlan(opts: {
  easyPath: PosterEasyPath;
  festivalId?: string;
  oneLineBrief?: string;
  posterStyleId: string;
  aspectRatio: string;
  references: PosterReference[];
  useBrandRefs: boolean;
}): PosterAutoPlan {
  const festival = getPosterFestivalPack(opts.festivalId);
  const garment = opts.references.find((r) => r.role === "garment");
  const model = opts.references.find((r) => r.role === "model");
  const scene = opts.references.find((r) => r.role === "scene");
  const brand = opts.references.filter((r) => r.role === "brand");

  let slotCopy = festival?.defaultTitle ?? "限时特惠";
  let sceneDescription = opts.oneLineBrief?.trim() || "电商促销主视觉，产品清晰居中";

  const briefNorm = opts.oneLineBrief?.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim() ?? "";
  if (briefNorm.includes("\n")) {
    const lines = briefNorm
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 4);
    if (lines.length >= 2) {
      slotCopy = lines.join("\n");
    }
  }

  if (opts.easyPath === "C") {
    slotCopy =
      briefNorm.includes("\n")
        ? slotCopy
        : briefNorm.slice(0, 80) || slotCopy;
    sceneDescription = `围绕「${slotCopy}」的电商营销海报摄影场景`;
  } else if (opts.easyPath === "B") {
    sceneDescription =
      "服装单品电商海报，通用时尚模特穿搭展示，" +
      (festival?.promptHint ?? "明亮商业摄影");
  } else if (opts.easyPath === "A") {
    sceneDescription = [
      model ? "指定模特参考穿搭" : "时尚模特",
      garment ? "展示上传服装" : "服装主体",
      scene ? "融合上传场景" : festival?.promptHint ?? "商业摄影场景",
    ].join("，");
  } else if (opts.easyPath === "D") {
    const title = festival?.defaultTitle ?? "品牌节日问候";
    slotCopy =
      briefNorm && !briefNorm.includes("\n")
        ? `${title}\n${briefNorm.slice(0, 48)}`
        : briefNorm.includes("\n")
          ? slotCopy
          : title;
    sceneDescription =
      "品牌节日创意海报，VI 延展氛围，" + (festival?.promptHint ?? "高端商业摄影");
    if (brand.length === 0 && !opts.useBrandRefs) {
      sceneDescription += "（建议导入 VI/Logo 参考）";
    }
  }

  const imagePrompt = buildMarketingPosterScenePrompt({
    sceneDescription,
    styleId: opts.posterStyleId,
    festivalHint: festival?.promptHint,
    aspectRatio: opts.aspectRatio,
    brandHint: opts.useBrandRefs && brand.length > 0 ? "follow brand reference colors" : undefined,
  });

  const exportWidthPx = exportWidthForAspect(opts.aspectRatio);
  const artifact = createDefaultArtifact({
    slotCopy,
    slotCopyAi: slotCopy,
    imagePrompt,
    exportWidthPx,
    sourceModule: "poster",
  });

  return {
    summary: `节日=${festival?.label ?? "默认"} · 路径=${opts.easyPath} · ${sceneDescription.slice(0, 60)}`,
    slotCopy: artifact.copy.slotCopy,
    slotCopyAi: slotCopy,
    imagePrompt,
    festivalId: opts.festivalId,
    easyPath: opts.easyPath,
  };
}
