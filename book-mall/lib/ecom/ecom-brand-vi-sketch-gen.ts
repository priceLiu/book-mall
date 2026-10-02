import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getEcomBrandViProject,
  resetBrandViProjectForNewSketch,
  updateEcomBrandViProject,
  type EcomBrandViProjectDto,
} from "@/lib/ecom/ecom-brand-vi-service";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_BRAND_VI_SKETCH_GENERATE_ACTION,
  ECOM_BRAND_VI_TOOL_KEY,
  BRAND_VI_SKETCH_GEN_MODEL,
  BRAND_VI_SKETCH_MAX,
  type BrandViReference,
} from "@/lib/ecom/ecom-brand-vi-types";

export { BRAND_VI_SKETCH_GEN_DEFAULT_PROMPT, BRAND_VI_SKETCH_GEN_MODEL } from "@/lib/ecom/ecom-brand-vi-types";

/**
 * 调用 wan2.7-image 生成线稿并写入项目 references。
 * - 已有线稿：以第 1 张为 IP 草图参考，生成后替换该槽位
 * - 无线稿：纯文生图，新增第 1 张线稿
 */
export async function generateBrandViSketchReference(opts: {
  userId: string;
  projectId: string;
  prompt: string;
  modelKey?: string;
  resetFlow?: boolean;
}): Promise<{ reference: BrandViReference; project: EcomBrandViProjectDto }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("请填写生图 Prompt");

  let project = await getEcomBrandViProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  if (opts.resetFlow) {
    project = await resetBrandViProjectForNewSketch(opts.userId, opts.projectId);
  }

  const modelKey = opts.modelKey?.trim() || BRAND_VI_SKETCH_GEN_MODEL;
  const seedRef = project.references[0]?.ossUrl?.trim();
  const refImageUrls = seedRef ? [seedRef] : [];

  const ossUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio: "1:1",
    refImageUrls,
    toolKey: `${ECOM_BRAND_VI_TOOL_KEY}__${ECOM_BRAND_VI_SKETCH_GENERATE_ACTION}`,
  });

  project = (await getEcomBrandViProject(opts.userId, opts.projectId))!;
  let reference: BrandViReference;

  if (project.references.length > 0) {
    const first = project.references[0]!;
    reference = {
      ...first,
      ossUrl,
      label: "AI 线稿",
    };
    await updateEcomBrandViProject(opts.userId, opts.projectId, {
      references: [reference, ...project.references.slice(1)],
    });
  } else {
    if (project.references.length >= BRAND_VI_SKETCH_MAX) {
      throw new Error(`最多 ${BRAND_VI_SKETCH_MAX} 张线稿，请先删除一张`);
    }
    reference = {
      id: `sketch-${Date.now()}-1`,
      label: "AI 线稿",
      role: "sketch",
      ossUrl,
    };
    await updateEcomBrandViProject(opts.userId, opts.projectId, {
      references: [reference],
    });
  }

  const updated = await getEcomBrandViProject(opts.userId, opts.projectId);
  if (!updated) throw new Error("项目不存在");
  return { reference, project: updated };
}
