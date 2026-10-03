import { createDefaultArtifact, type EcomCopyImageArtifact } from "@private/ecom-copy-overlay";

import { buildCopyAwareImageGenPlan } from "@/lib/ecom/copy-layout/image-gen-copy-policy";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import { buildMarketingPosterScenePrompt } from "@/lib/ecom/ecom-image-processing-presets";
import { getPosterFestivalPack } from "@/lib/ecom/ecom-poster-festival-packs";
import { getTemplateGalleryEntry } from "@/lib/ecom/ecom-template-gallery-service";
import {
  ECOM_POSTER_TOOL_KEY,
  exportWidthForAspect,
  type PosterPlan,
  type PosterReference,
  type PosterSettings,
} from "@/lib/ecom/ecom-poster-types";

function refUrls(refs: PosterReference[], roles: PosterReference["role"][]): string[] {
  return refs.filter((r) => roles.includes(r.role)).map((r) => r.ossUrl.trim());
}

export async function generatePosterImages(opts: {
  userId: string;
  projectId: string;
  plan: PosterPlan;
  settings: PosterSettings;
  references: PosterReference[];
  sceneDescription?: string;
  slotCopy?: string;
  imagePrompt?: string;
  count?: number;
  /** Gateway clientPage action 后缀，默认 generate */
  gatewayAction?: "generate" | "batch-generate";
}): Promise<{ artifacts: EcomCopyImageArtifact[]; urls: string[] }> {
  const modelKey =
    opts.plan.modelKey?.trim() ||
    opts.settings.imageModelKey?.trim() ||
    "doubao-seedream-5-0-lite";
  const count = Math.min(4, Math.max(1, opts.count ?? opts.settings.imageCount ?? 2));
  const festival = getPosterFestivalPack(opts.plan.festivalId);
  const slotCopy =
    opts.slotCopy?.trim() ||
    opts.plan.autoPlan?.slotCopy?.trim() ||
    festival?.defaultTitle ||
    "限时特惠";
  let scene =
    opts.sceneDescription?.trim() ||
    opts.imagePrompt?.trim() ||
    opts.plan.autoPlan?.imagePrompt?.trim() ||
    "电商营销海报摄影场景";

  const proMode = opts.plan.proMode ?? "text";
  let extraRefs: string[] = [];

  if (proMode === "template") {
    const templateId = opts.plan.templateCatalogId?.trim();
    if (!templateId) {
      throw new Error("请先选择电商模板");
    }
    const entry = await getTemplateGalleryEntry(templateId);
    if (!entry) {
      throw new Error("模板不存在或已下架");
    }
    const templateVisual =
      entry.posterUrl?.trim() ||
      entry.thumbUrl?.trim() ||
      entry.coverUrl?.trim() ||
      entry.mainImageUrl?.trim();
    if (templateVisual) {
      extraRefs.push(templateVisual);
    }
    scene = `参照电商详情模板「${entry.title ?? entry.id}」的版式与构图气质，重绘为新的营销海报摄影画面：${scene}`;
  } else if (proMode === "image-ref") {
    const styleRefs = refUrls(opts.references, ["style", "scene", "brand"]);
    if (styleRefs.length === 0) {
      throw new Error("图生模式请至少上传场景或风格参考");
    }
    extraRefs = styleRefs;
    scene = `在参考图构图与光影基础上生成新营销海报：${scene}`;
  }

  const baseScene = buildMarketingPosterScenePrompt({
    sceneDescription: scene,
    styleId: opts.plan.posterStyleId,
    festivalHint: festival?.promptHint,
    aspectRatio: opts.plan.aspectRatio,
    brandHint: opts.plan.useBrandRefs ? "brand vi reference" : undefined,
  });
  const plan = buildCopyAwareImageGenPlan({
    profile: "ecom-poster",
    basePositivePrompt: baseScene,
    slotCopy,
    burnCopyInImage: opts.plan.burnCopyInImage,
  });
  const refs = [
    ...extraRefs,
    ...refUrls(opts.references, ["garment", "model", "scene", "brand", "product", "style"]),
  ]
    .filter((u, i, arr) => u && arr.indexOf(u) === i)
    .slice(0, 5);

  const urls: string[] = [];
  const artifacts: EcomCopyImageArtifact[] = [];
  const exportWidthPx = exportWidthForAspect(opts.plan.aspectRatio);
  const action = opts.gatewayAction ?? "generate";
  const toolKey = `${ECOM_POSTER_TOOL_KEY}__${action}`;
  const workspaceId = opts.projectId;

  for (let i = 0; i < count; i++) {
    const result = await generateEcomImage({
      userId: opts.userId,
      modelKey,
      prompt: plan.promptForModel,
      negativePrompt: plan.negativePrompt,
      ratio: opts.plan.aspectRatio as "1:1" | "3:4" | "9:16" | "16:9",
      refImageUrls: refs,
      toolKey,
      workspaceId,
    });
    const url = result?.trim();
    if (!url) continue;
    urls.push(url);
    artifacts.push(
      createDefaultArtifact({
        slotCopy,
        slotCopyAi: opts.plan.autoPlan?.slotCopyAi ?? slotCopy,
        imagePrompt: baseScene,
        exportWidthPx,
        baseImageUrl: url,
        burnDefault: opts.plan.burnCopyInImage,
        sourceModule: "poster",
      }),
    );
  }
  if (urls.length === 0) throw new Error("海报生成失败，请稍后重试");
  return { artifacts, urls };
}
