import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import { extractSellpointsFromProductImages } from "@/lib/ecom/detail-page-suite/vision-sellpoint-extract";
import {
  getDetailPageSuiteAplusProject,
  updateDetailPageSuiteAplusProject,
} from "@/lib/ecom/detail-page-suite/project-service";
import { ECOM_AI_DETAIL_PAGE_TOOL_KEY } from "@/lib/ecom/detail-page-suite/types";

export async function visionAplusSellpointsFromProductImages(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}) {
  const project = await getDetailPageSuiteAplusProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length === 0) throw new Error("请先上传至少 1 张产品图");

  const modelKey =
    opts.modelKey?.trim() || project.settings.visionModelKey || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const urls = project.references
    .map((r) => r.ossUrl)
    .filter(Boolean)
    .slice(0, getVisionMaxInputImages(modelKey));

  const result = await extractSellpointsFromProductImages({
    userId: opts.userId,
    projectId: opts.projectId,
    toolKey: ECOM_AI_DETAIL_PAGE_TOOL_KEY,
    clientPageSuffix: `${ECOM_AI_DETAIL_PAGE_TOOL_KEY}__vision`,
    productUrls: urls,
    productDesc: project.brief?.productDesc,
    modelKey,
    settingsVisionModelKey: project.settings.visionModelKey,
  });

  const updated = await updateDetailPageSuiteAplusProject(opts.userId, opts.projectId, {
    brief: {
      ...(project.brief ?? {}),
      sellPoints: result.sellPoints,
      sellpointFivePart: result.sellpointFivePart,
      sellpointsLocked: false,
    },
    meta: { ...(project.meta ?? {}), phase: "sellpoints" },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}
