import { randomUUID } from "crypto";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { generateEcomImage } from "@/lib/ecom/ecom-image-gen-invoke";
import {
  getEcomModelShotProject,
  updateEcomModelShotProject,
  type EcomModelShotProjectDto,
} from "@/lib/ecom/ecom-model-shot-service";
import {
  ECOM_MODEL_SHOT_REF_GENERATE_ACTION,
  ECOM_MODEL_SHOT_TOOL_KEY,
  type ModelShotReference,
  type ModelShotReferenceRole,
} from "@/lib/ecom/ecom-model-shot-types";
import { ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";

const ROLE_RATIO: Record<ModelShotReferenceRole, EcomImageRatio> = {
  garment: "3:4",
  model: "3:4",
  scene: "16:9",
  prop: "1:1",
};

const ROLE_LABEL: Record<ModelShotReferenceRole, string> = {
  garment: "服装",
  model: "AI 模特",
  scene: "AI 场景",
  prop: "AI 道具",
};

export async function generateModelShotReferenceImage(opts: {
  userId: string;
  projectId: string;
  role: ModelShotReferenceRole;
  prompt: string;
  modelKey?: string;
}): Promise<{ reference: ModelShotReference; project: EcomModelShotProjectDto }> {
  if (opts.role === "garment") {
    throw new Error("服装参考请上传实拍图");
  }

  await assertEcomToolkitGatewayAccess(opts.userId);

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("请填写生图 Prompt");

  const project = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");

  const modelKey =
    opts.modelKey?.trim() ||
    project.settings.imageModelKey?.trim() ||
    ECOM_STORYBOARD_DEFAULT_IMAGE_MODEL;

  const ossUrl = await generateEcomImage({
    userId: opts.userId,
    modelKey,
    prompt,
    ratio: ROLE_RATIO[opts.role],
    refImageUrls: [],
    toolKey: `${ECOM_MODEL_SHOT_TOOL_KEY}__${ECOM_MODEL_SHOT_REF_GENERATE_ACTION}`,
  });

  const reference: ModelShotReference = {
    id: randomUUID(),
    role: opts.role,
    source: "ai-generate",
    ossUrl,
    description: prompt.slice(0, 500),
    label: ROLE_LABEL[opts.role],
  };

  const refs = project.references.filter((r) => r.role !== opts.role);
  refs.push(reference);

  const updated = await updateEcomModelShotProject(opts.userId, opts.projectId, {
    references: refs,
  });
  if (!updated) throw new Error("项目不存在");

  return { reference, project: updated };
}
