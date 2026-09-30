import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import {
  formatDetailPageSuiteSellpointDraft,
  sellpointFivePartToDetailPageSellpoints,
} from "@/lib/ecom/ecom-sellpoint-five-part";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import { extractSellpointsFromProductImages, polishSellpointFivePartFromBrief } from "./vision-sellpoint-extract";
import { getDetailPageSuiteProject, updateDetailPageSuiteProject } from "./project-service";
import { ECOM_DETAIL_PAGE_SUITE_TOOL_KEY, type DetailPageSuiteSellpoint } from "./types";

export async function visionSellpointsFromProductImages(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length === 0) throw new Error("请先上传至少 1 张产品图");

  const modelKey = opts.modelKey?.trim() || project.settings.visionModelKey || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const urls = project.references.map((r) => r.ossUrl).filter(Boolean).slice(0, getVisionMaxInputImages(modelKey));

  const result = await extractSellpointsFromProductImages({
    userId: opts.userId,
    projectId: opts.projectId,
    toolKey: ECOM_DETAIL_PAGE_SUITE_TOOL_KEY,
    clientPageSuffix: `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__vision`,
    productUrls: urls,
    productDesc: project.brief?.productDesc,
    modelKey,
    settingsVisionModelKey: project.settings.visionModelKey,
  });

  const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
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

export async function polishDetailPageSuiteSellpoints(opts: {
  userId: string;
  projectId: string;
  modelKey?: string;
}): Promise<NonNullable<Awaited<ReturnType<typeof getDetailPageSuiteProject>>>> {
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) throw new Error("项目不存在");
  const draft = formatDetailPageSuiteSellpointDraft(project.brief);
  if (!draft.trim() && !(project.brief?.sellPoints?.length ?? 0)) {
    throw new Error("请先手填或识图卖点再润色");
  }

  const modelKey = opts.modelKey?.trim() || project.settings.chatModelKey || ECOM_DEFAULT_VISION_MODEL;
  const part =
    project.brief?.sellpointFivePart ??
    ({
      productName: project.brief?.productDesc?.trim() || "（见产品图）",
      coreSellingPoints: (project.brief?.sellPoints ?? []).map((s) => s.text.trim()).filter(Boolean),
      targetAudience: "",
      usageScenarios: [],
      specifications: [],
    } as const);

  const polished = await polishSellpointFivePartFromBrief({
    userId: opts.userId,
    projectId: opts.projectId,
    clientPageSuffix: `${ECOM_DETAIL_PAGE_SUITE_TOOL_KEY}__chat`,
    modelKey,
    part,
  });

  const sellPoints: DetailPageSuiteSellpoint[] = sellpointFivePartToDetailPageSellpoints(
    polished,
    project.brief?.sellPoints,
  ).map((s) => ({ ...s, source: "ai" as const }));

  const updated = await updateDetailPageSuiteProject(opts.userId, opts.projectId, {
    brief: {
      ...(project.brief ?? {}),
      sellPoints,
      sellpointFivePart: polished,
      sellpointsLocked: false,
    },
    meta: { ...(project.meta ?? {}), phase: "sellpoints" },
  });
  if (!updated) throw new Error("保存失败");
  return updated;
}
