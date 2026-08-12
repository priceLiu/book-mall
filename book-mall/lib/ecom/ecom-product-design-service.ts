import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { sanitizeAdCopyDeep } from "@/lib/ecom/ecom-ad-compliance";
import {
  clampPlatformCounts,
  DEFAULT_ECOM_PLATFORM_CODE,
  getEcomPlatformSpec,
  type EcomPlatformCounts,
} from "@/lib/ecom/ecom-platform-spec";
import {
  ECOM_PRODUCT_DESIGN_MODULE,
  mergeProductDesign,
  parseProductDesign,
  sanitizeProductDesignChatMessages,
  sanitizeProductDesignReferences,
  type ProductDesign,
  type ProductDesignChatMessage,
  type ProductDesignReference,
  type ProductDesignSettings,
} from "@/lib/ecom/ecom-product-design-types";
import { prisma } from "@/lib/prisma";

function productDesignProjects() {
  const delegate = prisma.ecomProductDesignProject;
  if (!delegate) {
    throw new Error(
      "Prisma 客户端未包含 EcomProductDesignProject。请在 book-mall 执行 pnpm db:generate 并重启 book-mall 开发服务。",
    );
  }
  return delegate;
}

/** 将落库 settings 中的比例同步为平台规范（如淘宝主图 3:4） */
function normalizeProductDesignSettings(
  platformCode: string,
  settings: ProductDesignSettings,
): ProductDesignSettings {
  const clamped = clampPlatformCounts(platformCode, {
    mainImageCount: settings.mainImageCount,
    detailPageCount: settings.detailPageCount,
    mainImageRatio: settings.mainImageRatio,
    detailPageRatio: settings.detailPageRatio,
  });
  return {
    ...settings,
    mainImageRatio: clamped.mainImageRatio,
    detailPageRatio: clamped.detailPageRatio,
  };
}

async function persistNormalizedSettingsIfNeeded(row: ProjectRow): Promise<ProjectRow> {
  const prev = (row.settings as ProductDesignSettings | null) ?? {};
  const next = normalizeProductDesignSettings(row.platform ?? DEFAULT_ECOM_PLATFORM_CODE, prev);
  if (
    prev.mainImageRatio === next.mainImageRatio &&
    prev.detailPageRatio === next.detailPageRatio
  ) {
    return row;
  }
  return productDesignProjects().update({
    where: { id: row.id },
    data: { settings: next as Prisma.InputJsonValue },
  });
}

export type EcomProductDesignProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  platform: string;
  brief: Record<string, unknown> | null;
  settings: ProductDesignSettings;
  references: ProductDesignReference[];
  chatHistory: ProductDesignChatMessage[];
  design: ProductDesign | null;
  /** 由平台规则钳制后的最终张数/比例，前端直接用，勿再自行计算 */
  resolved: EcomPlatformCounts;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectRow = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  platform: string | null;
  brief: unknown;
  settings: unknown;
  references: unknown;
  chatHistory: unknown;
  design: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: ProjectRow): EcomProductDesignProjectDto {
  const settings = normalizeProductDesignSettings(
    row.platform ?? DEFAULT_ECOM_PLATFORM_CODE,
    (row.settings as ProductDesignSettings | null) ?? {},
  );
  const platform = row.platform ?? DEFAULT_ECOM_PLATFORM_CODE;
  const clamped = clampPlatformCounts(platform, settings);

  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    platform,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings,
    references: sanitizeProductDesignReferences(row.references),
    chatHistory: sanitizeProductDesignChatMessages(row.chatHistory),
    design: parseProductDesign(row.design),
    resolved: {
      mainImageCount: clamped.mainImageCount,
      detailPageCount: clamped.detailPageCount,
      mainImageRatio: clamped.mainImageRatio,
      detailPageRatio: clamped.detailPageRatio,
    },
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type EcomProductDesignProjectSummary = {
  id: string;
  title: string | null;
  platform: string;
  updatedAt: string;
};

export async function listProductDesignProjectSummaries(
  userId: string,
): Promise<EcomProductDesignProjectSummary[]> {
  const rows = await productDesignProjects().findMany({
    where: { userId, module: ECOM_PRODUCT_DESIGN_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, platform: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    platform: row.platform ?? DEFAULT_ECOM_PLATFORM_CODE,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createProductDesignProject(
  userId: string,
  opts?: { title?: string; platform?: string; brief?: Record<string, unknown> },
): Promise<EcomProductDesignProjectDto> {
  const spec = getEcomPlatformSpec(opts?.platform ?? DEFAULT_ECOM_PLATFORM_CODE);
  const row = await productDesignProjects().create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "电商产品创作",
      platform: spec.code,
      brief: (opts?.brief ?? {}) as Prisma.InputJsonValue,
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      settings: {
        mainImageCount: spec.mainImage.recommended,
        detailPageCount: spec.detailPage.recommended,
        mainImageRatio: spec.mainImage.ratio,
        detailPageRatio: spec.detailPage.ratio,
      } as Prisma.InputJsonValue,
      meta: { setupPhase: "product" } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getProductDesignProject(
  userId: string,
  projectId: string,
): Promise<EcomProductDesignProjectDto | null> {
  const row = await productDesignProjects().findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  const normalized = await persistNormalizedSettingsIfNeeded(row);
  return rowToDto(normalized);
}

export type ProductDesignPatch = {
  title?: string;
  platform?: string;
  status?: string;
  brief?: Record<string, unknown>;
  settings?: ProductDesignSettings;
  references?: ProductDesignReference[];
  chatHistory?: ProductDesignChatMessage[];
  /** 整份替换 */
  design?: ProductDesign | null;
  /** 增量合并，助手每步只回传本步字段 */
  designPatch?: Partial<ProductDesign>;
  meta?: Record<string, unknown>;
};

export async function updateProductDesignProject(
  userId: string,
  projectId: string,
  patch: ProductDesignPatch,
): Promise<EcomProductDesignProjectDto> {
  const existing = await productDesignProjects().findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomProductDesignProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 120);
  if (patch.platform !== undefined) {
    data.platform = getEcomPlatformSpec(patch.platform).code;
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.brief !== undefined) {
    const prev = (existing.brief as Record<string, unknown> | null) ?? {};
    data.brief = { ...prev, ...patch.brief } as Prisma.InputJsonValue;
  }
  if (patch.settings !== undefined) {
    const prev = (existing.settings as ProductDesignSettings | null) ?? {};
    data.settings = { ...prev, ...patch.settings } as Prisma.InputJsonValue;
  }
  if (patch.references !== undefined) {
    data.references = sanitizeProductDesignReferences(
      patch.references,
    ) as Prisma.InputJsonValue;
  }
  if (patch.chatHistory !== undefined) {
    data.chatHistory = sanitizeProductDesignChatMessages(
      patch.chatHistory,
    ) as Prisma.InputJsonValue;
  }
  if (patch.design !== undefined) {
    data.design =
      patch.design === null
        ? Prisma.JsonNull
        : (sanitizeAdCopyDeep(patch.design).value as Prisma.InputJsonValue);
  } else if (patch.designPatch !== undefined) {
    const prev = parseProductDesign(existing.design);
    const merged = mergeProductDesign(prev, patch.designPatch);
    data.design = sanitizeAdCopyDeep(merged).value as Prisma.InputJsonValue;
  }
  if (patch.meta !== undefined) {
    const prev = (existing.meta as Record<string, unknown> | null) ?? {};
    data.meta = { ...prev, ...patch.meta } as Prisma.InputJsonValue;
  }

  const row = await productDesignProjects().update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

/** 整项目重置：清空聊天、表单、设计稿、参考图与进度，保留项目 id */
export async function resetProductDesignProject(
  userId: string,
  projectId: string,
): Promise<EcomProductDesignProjectDto> {
  const existing = await productDesignProjects().findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const spec = getEcomPlatformSpec(DEFAULT_ECOM_PLATFORM_CODE);
  const prevSettings = (existing.settings as ProductDesignSettings | null) ?? {};

  const row = await productDesignProjects().update({
    where: { id: projectId },
    data: {
      status: "draft",
      platform: spec.code,
      brief: Prisma.JsonNull,
      design: Prisma.JsonNull,
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      meta: { setupPhase: "product" } as Prisma.InputJsonValue,
      settings: {
        chatModelKey: prevSettings.chatModelKey,
        imageModelKey: prevSettings.imageModelKey,
        visionModelKey: prevSettings.visionModelKey,
        mainImageCount: spec.mainImage.recommended,
        detailPageCount: spec.detailPage.recommended,
        mainImageRatio: spec.mainImage.ratio,
        detailPageRatio: spec.detailPage.ratio,
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function deleteProductDesignProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const row = await productDesignProjects().findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!row) throw new Error("项目不存在");
  await productDesignProjects().delete({ where: { id: projectId } });
}

export async function addProductDesignReferenceUpload(
  userId: string,
  projectId: string,
  opts: { label: string; role: ProductDesignReference["role"]; buf: Buffer },
): Promise<ProductDesignReference> {
  const project = await getProductDesignProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const ref: ProductDesignReference = {
    id: `ref-${Date.now()}`,
    label: opts.label.slice(0, 40) || "参考图",
    role: opts.role,
    ossUrl,
  };
  await updateProductDesignProject(userId, projectId, {
    references: [...project.references, ref],
  });
  return ref;
}

export async function removeProductDesignReference(
  userId: string,
  projectId: string,
  refId: string,
): Promise<void> {
  const project = await getProductDesignProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  await updateProductDesignProject(userId, projectId, {
    references: project.references.filter((r) => r.id !== refId),
  });
}
