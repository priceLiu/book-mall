import { prisma } from "@/lib/prisma";
import { ECOM_BRAND_VI_MODULE } from "@/lib/ecom/ecom-brand-vi-types";
import { ECOM_HAND_CRAFT_MODULE } from "@/lib/ecom/ecom-hand-craft-types";
import { ECOM_IP_MASTER_MODULE } from "@/lib/ecom/ecom-ip-master-types";
import { ECOM_POSTER_MODULE } from "@/lib/ecom/ecom-poster-types";
import { ECOM_MEDIA_DECOMPOSE_MODULE } from "@/lib/ecom/ecom-media-decompose-types";
import { ECOM_MODEL_SHOT_MODULE } from "@/lib/ecom/ecom-model-shot-types";
import { parseModelShotPlan } from "@/lib/ecom/ecom-model-shot-types";
import {
  ECOM_PROJECT_MODULE_DETAIL,
  ECOM_PROJECT_MODULE_MAIN,
} from "@/lib/ecom/ecom-product-design-types";
import { getProVerticalConfig, resolveWorkflowVertical } from "@/lib/ecom/pro-vertical/registry";
import { ECOM_SEED_VIDEO_MODULE } from "@/lib/ecom/ecom-seed-video-types";
import {
  ECOM_STORYBOARD_MODULE,
  type StoryboardReference,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";

export type EcomWorkflowDraftKind =
  | "storyboard"
  | "product-design-main"
  | "product-design-detail"
  | "hand-craft"
  | "ip-master"
  | "brand-vi"
  | "poster"
  | "seed-video"
  | "media-decompose"
  | "model-shot";

export type EcomWorkflowDraftItem = {
  kind: EcomWorkflowDraftKind;
  projectId: string;
  title: string;
  featureLabel: string;
  domainLabel: "电商" | "视频";
  phaseLabel: string;
  summary: string;
  thumbnailUrl: string | null;
  updatedAt: string;
};

const STORYBOARD_PHASE_LABELS: Record<string, string> = {
  product_ref: "产品参考",
  dimensions: "维度选择",
  sellpoints: "卖点策划",
  voiceover: "口播方案",
  storyboard: "分镜方案",
  storyboard_confirm: "分镜定稿",
  output_mode: "成片方式",
  produce: "分镜生产",
  done: "已完成",
};

function firstRefUrl(references: unknown): string | null {
  if (!Array.isArray(references)) return null;
  for (const raw of references) {
    if (!raw || typeof raw !== "object") continue;
    const url = (raw as { ossUrl?: unknown }).ossUrl;
    if (typeof url === "string" && url.trim()) return url.trim();
  }
  return null;
}

function storyboardThumbnail(
  sheet: unknown,
  references: unknown,
): string | null {
  const parsed = sheet as StoryboardSheet | null;
  if (parsed?.panels?.length) {
    for (const panel of parsed.panels) {
      const url = panel.imageUrl?.trim();
      if (url) return url;
    }
  }
  const refs = Array.isArray(references)
    ? (references as StoryboardReference[])
    : [];
  return (
    refs.find((r) => r.role === "product")?.ossUrl?.trim() ??
    refs[0]?.ossUrl?.trim() ??
    null
  );
}

function storyboardFeatureLabel(meta: unknown): string {
  const wf = (meta as { workflow?: Record<string, unknown> } | null)?.workflow;
  const vertical = resolveWorkflowVertical(wf ?? null);
  const config = getProVerticalConfig(vertical);
  if (config?.label) return `${config.label}专业版`;
  if (vertical === "fashion_apparel") return "服装专业版";
  return "电商口播故事版";
}

function storyboardPhaseLabel(meta: unknown): string {
  const wf = (meta as { workflow?: Record<string, unknown> } | null)?.workflow ?? {};
  const phase =
    (typeof wf.proPhase === "string" && wf.proPhase) ||
    (typeof wf.fashionPhase === "string" && wf.fashionPhase) ||
    (typeof wf.phase === "string" && wf.phase) ||
    "product_ref";
  return STORYBOARD_PHASE_LABELS[phase] ?? phase;
}

function storyboardSummary(sheet: unknown, status: string | null): string {
  const parsed = sheet as StoryboardSheet | null;
  const panelCount = parsed?.panels?.length ?? 0;
  const imageCount =
    parsed?.panels?.filter((p) => Boolean(p.imageUrl?.trim())).length ?? 0;
  const parts: string[] = [];
  if (panelCount > 0) parts.push(`${panelCount} 镜`);
  if (imageCount > 0) parts.push(`${imageCount} 张分镜图`);
  if (parts.length === 0 && status?.trim()) parts.push(status);
  return parts.join(" · ") || "进行中";
}

async function listStoryboardDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomStoryboardProject.findMany({
    where: { userId, module: ECOM_STORYBOARD_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      title: true,
      status: true,
      sheet: true,
      references: true,
      meta: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    kind: "storyboard",
    projectId: row.id,
    title: row.title?.trim() || "未命名故事版",
    featureLabel: storyboardFeatureLabel(row.meta),
    domainLabel: "视频",
    phaseLabel: storyboardPhaseLabel(row.meta),
    summary: storyboardSummary(row.sheet, row.status),
    thumbnailUrl: storyboardThumbnail(row.sheet, row.references),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

async function listProductDesignDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomProductDesignProject.findMany({
    where: {
      userId,
      module: { in: [ECOM_PROJECT_MODULE_MAIN, ECOM_PROJECT_MODULE_DETAIL] },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      title: true,
      module: true,
      status: true,
      brief: true,
      references: true,
      design: true,
      meta: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const isDetail = row.module === ECOM_PROJECT_MODULE_DETAIL;
    const design = row.design as { slots?: unknown[] } | null;
    const slotCount = Array.isArray(design?.slots) ? design!.slots!.length : 0;
    const brief = row.brief as Record<string, unknown> | null;
    const productName =
      typeof brief?.productName === "string" ? brief.productName.trim() : "";
    return {
      kind: isDetail ? "product-design-detail" : "product-design-main",
      projectId: row.id,
      title: row.title?.trim() || productName || (isDetail ? "详情页项目" : "主图项目"),
      featureLabel: isDetail ? "电商详情页" : "电商主图",
      domainLabel: "电商",
      phaseLabel: row.status?.trim() || "策划中",
      summary:
        slotCount > 0
          ? `${slotCount} 个槽位`
          : productName
            ? `产品：${productName}`
            : "进行中",
      thumbnailUrl: firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function listBrandViDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomBrandViProject.findMany({
    where: { userId, module: ECOM_BRAND_VI_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      meta: true,
      plan: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const meta = row.meta as { workflow?: { currentStepId?: string } } | null;
    const stepId = meta?.workflow?.currentStepId ?? "hero";
    const plan = row.plan as { steps?: Record<string, unknown> } | null;
    const stepCount = plan?.steps ? Object.keys(plan.steps).length : 0;
    return {
      kind: "brand-vi",
      projectId: row.id,
      title: row.title?.trim() || "品牌VI表情包SOP",
      featureLabel: "品牌VI表情包SOP",
      domainLabel: "电商",
      phaseLabel: `步骤 ${stepId}`,
      summary: stepCount > 0 ? `${stepCount} 步已填写` : "进行中",
      thumbnailUrl: firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function listIpMasterDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomIpMasterProject.findMany({
    where: { userId, module: ECOM_IP_MASTER_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      meta: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const meta = row.meta as {
      workflow?: { currentStepId?: string; activeVersion?: string };
      templateVersions?: unknown[];
    } | null;
    const stepId = meta?.workflow?.currentStepId ?? "input";
    const versionCount = meta?.templateVersions?.length ?? 0;
    return {
      kind: "ip-master",
      projectId: row.id,
      title: row.title?.trim() || "IP 母版",
      featureLabel: "IP 母版",
      domainLabel: "电商",
      phaseLabel: `步骤 ${stepId}`,
      summary:
        versionCount > 0
          ? `${versionCount} 个模板版本 · ${meta?.workflow?.activeVersion ?? ""}`
          : "进行中",
      thumbnailUrl: firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function listPosterDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomPosterProject.findMany({
    where: { userId, module: ECOM_POSTER_MODULE, status: { not: "archived" } },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      plan: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const plan = row.plan as { artifacts?: unknown[]; tier?: string; easyPath?: string } | null;
    const artifactCount = plan?.artifacts?.length ?? 0;
    return {
      kind: "poster",
      projectId: row.id,
      title: row.title?.trim() || "营销海报",
      featureLabel: "海报制作",
      domainLabel: "电商",
      phaseLabel: plan?.tier === "pro" ? "专业创作" : `傻瓜 · ${plan?.easyPath ?? "C"}`,
      summary: artifactCount > 0 ? `${artifactCount} 张候选/成图` : "进行中",
      thumbnailUrl: firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function listHandCraftDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomHandCraftProject.findMany({
    where: { userId, module: ECOM_HAND_CRAFT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      meta: true,
      plan: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const meta = row.meta as { workflow?: { currentStepId?: string } } | null;
    const stepId = meta?.workflow?.currentStepId ?? "hero";
    const plan = row.plan as { steps?: Record<string, unknown> } | null;
    const stepCount = plan?.steps ? Object.keys(plan.steps).length : 0;
    return {
      kind: "hand-craft",
      projectId: row.id,
      title: row.title?.trim() || "手办盲盒 SOP",
      featureLabel: "手办盲盒 SOP",
      domainLabel: "电商",
      phaseLabel: `步骤 ${stepId}`,
      summary: stepCount > 0 ? `${stepCount} 步已填写` : "进行中",
      thumbnailUrl: firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function listSeedVideoDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomSeedVideoProject.findMany({
    where: { userId, module: ECOM_SEED_VIDEO_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      plan: true,
      meta: true,
      updatedAt: true,
    },
  });
  return rows
    .filter((row) => {
      const meta = row.meta as Record<string, unknown> | null;
      return typeof meta?.sourceMediaDecomposeProjectId !== "string";
    })
    .map((row) => {
      const wf = (row.meta as { workflow?: { phase?: string } } | null)?.workflow;
      const phase = wf?.phase?.trim() || row.status?.trim() || "material";
      const plan = row.plan as { shots?: unknown[] } | null;
      const shotCount = Array.isArray(plan?.shots) ? plan!.shots!.length : 0;
      return {
        kind: "seed-video",
        projectId: row.id,
        title: row.title?.trim() || "种草视频",
        featureLabel: "服装种草视频",
        domainLabel: "视频",
        phaseLabel: phase,
        summary: shotCount > 0 ? `${shotCount} 镜脚本` : "进行中",
        thumbnailUrl: firstRefUrl(row.references),
        updatedAt: row.updatedAt.toISOString(),
      };
    });
}

async function listMediaDecomposeDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomMediaDecomposeProject.findMany({
    where: { userId, module: ECOM_MEDIA_DECOMPOSE_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      result: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const result = row.result as { shots?: unknown[]; mediaKind?: string } | null;
    const shotCount = Array.isArray(result?.shots) ? result!.shots!.length : 0;
    const mediaKind = result?.mediaKind === "video" ? "视频" : result?.mediaKind === "image" ? "图片" : null;
    return {
      kind: "media-decompose",
      projectId: row.id,
      title: row.title?.trim() || "拆图拆视频",
      featureLabel: "拆图拆视频",
      domainLabel: "电商",
      phaseLabel: row.status?.trim() || "拆解中",
      summary:
        shotCount > 0
          ? `${shotCount} 镜${mediaKind ? ` · ${mediaKind}` : ""}`
          : mediaKind ?? "进行中",
      thumbnailUrl: firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function listModelShotDrafts(userId: string): Promise<EcomWorkflowDraftItem[]> {
  const rows = await prisma.ecomModelShotProject.findMany({
    where: { userId, module: ECOM_MODEL_SHOT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      references: true,
      plan: true,
      meta: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => {
    const plan = parseModelShotPlan(row.plan);
    const imageCount = plan.items.filter((item) => item.imageUrl?.trim()).length;
    const phase =
      (row.meta as { phase?: string; workflow?: { phase?: string } } | null)?.workflow?.phase ??
      (row.meta as { phase?: string } | null)?.phase ??
      row.status?.trim() ??
      "garment";
    return {
      kind: "model-shot",
      projectId: row.id,
      title: row.title?.trim() || "服装模特图",
      featureLabel: "服装模特图",
      domainLabel: "电商",
      phaseLabel: phase,
      summary:
        plan.items.length > 0
          ? `${plan.items.length} 个姿势${imageCount > 0 ? ` · ${imageCount} 张成图` : ""}`
          : "进行中",
      thumbnailUrl:
        plan.items.find((item) => item.imageUrl?.trim())?.imageUrl?.trim() ??
        firstRefUrl(row.references),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

export async function listEcomWorkflowDrafts(
  userId: string,
): Promise<EcomWorkflowDraftItem[]> {
  const [
    storyboard,
    productDesign,
    handCraft,
    ipMaster,
    brandVi,
    poster,
    seedVideo,
    mediaDecompose,
    modelShot,
  ] = await Promise.all([
    listStoryboardDrafts(userId),
    listProductDesignDrafts(userId),
    listHandCraftDrafts(userId),
    listIpMasterDrafts(userId),
    listBrandViDrafts(userId),
    listPosterDrafts(userId),
    listSeedVideoDrafts(userId),
    listMediaDecomposeDrafts(userId),
    listModelShotDrafts(userId),
  ]);
  return [
    ...storyboard,
    ...productDesign,
    ...handCraft,
    ...ipMaster,
    ...brandVi,
    ...poster,
    ...seedVideo,
    ...mediaDecompose,
    ...modelShot,
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
