import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  getEcomHandCraftProject,
  resetHandCraftProjectForNewSketch,
  updateEcomHandCraftProject,
  type EcomHandCraftProjectDto,
} from "@/lib/ecom/ecom-hand-craft-service";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  ECOM_HAND_CRAFT_SKETCH_GENERATE_ACTION,
  ECOM_HAND_CRAFT_TOOL_KEY,
  HAND_CRAFT_SKETCH_GEN_MODEL,
  HAND_CRAFT_SKETCH_MAX,
  type HandCraftReference,
} from "@/lib/ecom/ecom-hand-craft-types";

export { HAND_CRAFT_SKETCH_GEN_DEFAULT_PROMPT, HAND_CRAFT_SKETCH_GEN_MODEL } from "@/lib/ecom/ecom-hand-craft-types";

/**
 * 调用 wan2.7-image 生成线稿并写入项目 references。
 * - 已有线稿：以第 1 张为 IP 草图参考，生成后替换该槽位
 * - 无线稿：纯文生图，新增第 1 张线稿
 */
export async function generateHandCraftSketchReference(opts: {
  userId: string;
  projectId: string;
  prompt: string;
  modelKey?: string;
  resetFlow?: boolean;
}): Promise<{ reference: HandCraftReference; project: EcomHandCraftProjectDto }> {
  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("请填写生图 Prompt");

  let project = await getEcomHandCraftProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  if (opts.resetFlow) {
    project = await resetHandCraftProjectForNewSketch(opts.userId, opts.projectId);
  }

  const modelKey = opts.modelKey?.trim() || HAND_CRAFT_SKETCH_GEN_MODEL;
  const seedRef = project.references[0]?.ossUrl?.trim();
  const refImageUrls = seedRef ? [seedRef] : [];

  const ossUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio: "1:1",
    refImageUrls,
    toolKey: `${ECOM_HAND_CRAFT_TOOL_KEY}__${ECOM_HAND_CRAFT_SKETCH_GENERATE_ACTION}`,
  });

  project = (await getEcomHandCraftProject(opts.userId, opts.projectId))!;
  let reference: HandCraftReference;

  if (project.references.length > 0) {
    const first = project.references[0]!;
    reference = {
      ...first,
      ossUrl,
      label: "AI 线稿",
    };
    await updateEcomHandCraftProject(opts.userId, opts.projectId, {
      references: [reference, ...project.references.slice(1)],
    });
  } else {
    if (project.references.length >= HAND_CRAFT_SKETCH_MAX) {
      throw new Error(`最多 ${HAND_CRAFT_SKETCH_MAX} 张线稿，请先删除一张`);
    }
    reference = {
      id: `sketch-${Date.now()}-1`,
      label: "AI 线稿",
      role: "sketch",
      ossUrl,
    };
    await updateEcomHandCraftProject(opts.userId, opts.projectId, {
      references: [reference],
    });
  }

  const updated = await getEcomHandCraftProject(opts.userId, opts.projectId);
  if (!updated) throw new Error("项目不存在");
  return { reference, project: updated };
}
