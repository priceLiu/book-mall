import { Prisma } from "@prisma/client";

import { createEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { ECOM_FILM_PULL_MODULE } from "@/lib/ecom/ecom-film-pull-types";
import { createEcomHandCraftProject } from "@/lib/ecom/ecom-hand-craft-service";
import { ECOM_HAND_CRAFT_MODULE } from "@/lib/ecom/ecom-hand-craft-types";
import { createEcomMediaDecomposeProject } from "@/lib/ecom/ecom-media-decompose-service";
import { ECOM_MEDIA_DECOMPOSE_MODULE } from "@/lib/ecom/ecom-media-decompose-types";
import { createEcomModelShotProject } from "@/lib/ecom/ecom-model-shot-service";
import { ECOM_MODEL_SHOT_MODULE } from "@/lib/ecom/ecom-model-shot-types";
import { createProductDesignProject } from "@/lib/ecom/ecom-product-design-service";
import { createEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { createEcomStoryboardProject } from "@/lib/ecom/ecom-storyboard-service";
import { ECOM_STORYBOARD_MODULE } from "@/lib/ecom/ecom-storyboard-types";
import { prisma } from "@/lib/prisma";

export const ECOM_WORKFLOW_SHARE_RESOURCE = {
  storyboard: "ecom_storyboard_project",
  modelShot: "ecom_model_shot_project",
  productDesign: "ecom_product_design_project",
  handCraft: "ecom_hand_craft_project",
  seedVideo: "ecom_seed_video_project",
  mediaDecompose: "ecom_media_decompose_project",
  filmPull: "ecom_film_pull_project",
} as const;

function shareTitle(base: string | null | undefined, fallback: string): string {
  return `${base?.trim() || fallback}（分享副本）`.slice(0, 120);
}

export function ecomWorkflowShareRedirectPath(
  resourceType: string,
  clonedResourceId: string,
): string {
  const q = encodeURIComponent(clonedResourceId);
  switch (resourceType) {
    case ECOM_WORKFLOW_SHARE_RESOURCE.modelShot:
      return `/ecom/model-shot?projectId=${q}`;
    case ECOM_WORKFLOW_SHARE_RESOURCE.productDesign:
      return `/ecom/product-creation?projectId=${q}`;
    case ECOM_WORKFLOW_SHARE_RESOURCE.handCraft:
      return `/ecom/hand-craft?projectId=${q}`;
    case ECOM_WORKFLOW_SHARE_RESOURCE.seedVideo:
      return `/ecom/seed-video?projectId=${q}`;
    case ECOM_WORKFLOW_SHARE_RESOURCE.mediaDecompose:
      return `/ecom/media-decompose?projectId=${q}`;
    case ECOM_WORKFLOW_SHARE_RESOURCE.filmPull:
      return `/ecom/film-pull?projectId=${q}`;
    case ECOM_WORKFLOW_SHARE_RESOURCE.storyboard:
    default:
      return `/ecom/storyboard/micro-drama?projectId=${q}`;
  }
}

/** claim 后解析跳转（详情页模块需查库） */
export async function resolveEcomWorkflowShareRedirectPath(
  resourceType: string,
  clonedResourceId: string,
): Promise<string> {
  if (resourceType === ECOM_WORKFLOW_SHARE_RESOURCE.productDesign) {
    const row = await prisma.ecomProductDesignProject.findUnique({
      where: { id: clonedResourceId },
      select: { module: true },
    });
    const q = encodeURIComponent(clonedResourceId);
    if (row?.module === "detail-page") {
      return `/ecom/detail-page-creation?projectId=${q}`;
    }
    return `/ecom/product-creation?projectId=${q}`;
  }
  return ecomWorkflowShareRedirectPath(resourceType, clonedResourceId);
}

export function ecomWorkflowShareSessionStorageKey(resourceType: string): string | null {
  switch (resourceType) {
    case ECOM_WORKFLOW_SHARE_RESOURCE.storyboard:
      return "ecom-storyboard-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.modelShot:
      return "ecom-model-shot-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.handCraft:
      return "ecom-hand-craft-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.seedVideo:
      return "ecom-seed-video-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.mediaDecompose:
      return "ecom-media-decompose-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.filmPull:
      return "ecom-film-pull-active-project";
    case ECOM_WORKFLOW_SHARE_RESOURCE.productDesign:
      return "ecom-product-design-active-project:main-image";
    default:
      return null;
  }
}

export async function duplicateEcomWorkflowForShareClaim(input: {
  resourceType: string;
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  switch (input.resourceType) {
    case ECOM_WORKFLOW_SHARE_RESOURCE.modelShot:
      return duplicateModelShot(input);
    case ECOM_WORKFLOW_SHARE_RESOURCE.productDesign:
      return duplicateProductDesign(input);
    case ECOM_WORKFLOW_SHARE_RESOURCE.handCraft:
      return duplicateHandCraft(input);
    case ECOM_WORKFLOW_SHARE_RESOURCE.seedVideo:
      return duplicateSeedVideo(input);
    case ECOM_WORKFLOW_SHARE_RESOURCE.mediaDecompose:
      return duplicateMediaDecompose(input);
    case ECOM_WORKFLOW_SHARE_RESOURCE.filmPull:
      return duplicateFilmPull(input);
    case ECOM_WORKFLOW_SHARE_RESOURCE.storyboard:
    default:
      return duplicateStoryboard(input);
  }
}

async function duplicateStoryboard(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomStoryboardProject.findFirst({
    where: { id: input.sourceProjectId, userId: input.sharerUserId, module: ECOM_STORYBOARD_MODULE },
  });
  if (!source) throw new Error("分镜项目不存在或无权分享");

  const created = await createEcomStoryboardProject(input.claimerUserId, {
    title: shareTitle(source.title, "微剧故事版"),
    brief: (source.brief ?? {}) as Record<string, unknown>,
  });
  await prisma.ecomStoryboardProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      sheet: source.sheet ?? Prisma.JsonNull,
      sheetPngUrl: source.sheetPngUrl,
      sheetHtmlUrl: source.sheetHtmlUrl,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}

async function duplicateModelShot(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomModelShotProject.findFirst({
    where: { id: input.sourceProjectId, userId: input.sharerUserId, module: ECOM_MODEL_SHOT_MODULE },
  });
  if (!source) throw new Error("服装模特图项目不存在或无权分享");

  const created = await createEcomModelShotProject(input.claimerUserId, {
    title: shareTitle(source.title, "服装模特图"),
  });
  await prisma.ecomModelShotProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      brief: source.brief ?? Prisma.JsonNull,
      plan: source.plan ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}

async function duplicateProductDesign(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomProductDesignProject.findFirst({
    where: { id: input.sourceProjectId, userId: input.sharerUserId },
  });
  if (!source) throw new Error("产品创作项目不存在或无权分享");

  const created = await createProductDesignProject(input.claimerUserId, {
    title: shareTitle(source.title, "产品创作"),
    platform: source.platform ?? undefined,
    module: source.module as "main-image" | "detail-page",
  });
  await prisma.ecomProductDesignProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      brief: source.brief ?? Prisma.JsonNull,
      design: source.design ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}

async function duplicateHandCraft(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomHandCraftProject.findFirst({
    where: { id: input.sourceProjectId, userId: input.sharerUserId, module: ECOM_HAND_CRAFT_MODULE },
  });
  if (!source) throw new Error("手伴创作项目不存在或无权分享");

  const created = await createEcomHandCraftProject(input.claimerUserId, {
    title: shareTitle(source.title, "手伴创作"),
  });
  await prisma.ecomHandCraftProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      brief: source.brief ?? Prisma.JsonNull,
      plan: source.plan ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}

async function duplicateSeedVideo(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomSeedVideoProject.findFirst({
    where: { id: input.sourceProjectId, userId: input.sharerUserId },
  });
  if (!source) throw new Error("种草视频项目不存在或无权分享");

  const settings = (source.settings as Record<string, unknown> | null) ?? {};
  const created = await createEcomSeedVideoProject(input.claimerUserId, {
    title: shareTitle(source.title, "种草视频"),
    skillKey: typeof settings.skillKey === "string" ? settings.skillKey : undefined,
  });
  await prisma.ecomSeedVideoProject.update({
    where: { id: created.id },
    data: {
      references: source.references ?? [],
      chatHistory: source.chatHistory ?? [],
      settings: source.settings ?? {},
      brief: source.brief ?? Prisma.JsonNull,
      plan: source.plan ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}

async function duplicateMediaDecompose(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomMediaDecomposeProject.findFirst({
    where: {
      id: input.sourceProjectId,
      userId: input.sharerUserId,
      module: ECOM_MEDIA_DECOMPOSE_MODULE,
    },
  });
  if (!source) throw new Error("拆图拆视频项目不存在或无权分享");

  const created = await createEcomMediaDecomposeProject(input.claimerUserId, {
    title: shareTitle(source.title, "拆图拆视频"),
  });
  await prisma.ecomMediaDecomposeProject.update({
    where: { id: created.id },
    data: {
      settings: source.settings ?? {},
      references: source.references ?? Prisma.JsonNull,
      result: source.result ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}

async function duplicateFilmPull(input: {
  sourceProjectId: string;
  sharerUserId: string;
  claimerUserId: string;
}): Promise<string> {
  const source = await prisma.ecomFilmPullProject.findFirst({
    where: { id: input.sourceProjectId, userId: input.sharerUserId, module: ECOM_FILM_PULL_MODULE },
  });
  if (!source) throw new Error("专业拉片项目不存在或无权分享");

  const created = await createEcomFilmPullProject(input.claimerUserId, {
    title: shareTitle(source.title, "专业拉片"),
  });
  await prisma.ecomFilmPullProject.update({
    where: { id: created.id },
    data: {
      settings: source.settings ?? {},
      references: source.references ?? Prisma.JsonNull,
      analyzeResult: source.analyzeResult ?? Prisma.JsonNull,
      renderScript: source.renderScript ?? Prisma.JsonNull,
      characterRefs: source.characterRefs ?? Prisma.JsonNull,
      renderPlan: source.renderPlan ?? Prisma.JsonNull,
      refMatch: source.refMatch ?? Prisma.JsonNull,
      productionPlan: source.productionPlan ?? Prisma.JsonNull,
      chatHistory: source.chatHistory ?? Prisma.JsonNull,
      meta: source.meta ?? Prisma.JsonNull,
      status: source.status,
    },
  });
  return created.id;
}
