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
  ECOM_PROJECT_MODULE_DETAIL,
  ECOM_PROJECT_MODULE_MAIN,
  mergeProductDesign,
  parseProductDesign,
  projectModuleQueryValues,
  sanitizeProductDesignChatMessages,
  sanitizeProductDesignReferences,
  type EcomProjectModule,
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

/**
 * 下列 4 个字段需要读 brief / references / design 三个 JSON 列（design 可能很大），
 * 只在「选择已有主图项目」选择器里用得上，故仅 detailed 模式返回。
 * 工作台挂载只用得到 id，走默认的轻量查询。
 */
export type EcomProductDesignProjectSummary = {
  id: string;
  title: string | null;
  platform: string;
  updatedAt: string;
  /** 首张产品参考图，供「选择已有主图项目」选择器展示 */
  thumbnailUrl?: string | null;
  /** brief.productName，选择器里比 title 更好认 */
  productName?: string | null;
  /** 已产出的主图张数，判断源项目是否值得导入 */
  mainImageCount?: number;
  /** Step0–3 是否齐备，齐备才能整套导入策略 */
  strategyReady?: boolean;
};

function firstProductRefUrl(references: unknown): string | null {
  const refs = sanitizeProductDesignReferences(references);
  return refs.find((r) => r.role === "product")?.ossUrl ?? null;
}

/** Step0–3 是否齐备：brief 四要素 + 平台拆解 + 已选营销方案 + 购买理由 */
function isStrategySnapshotReady(
  brief: Record<string, unknown> | null,
  design: ProductDesign | null,
): boolean {
  if (!design) return false;
  if (!design.analysis) return false;
  if (!design.selectedPlanNo) return false;
  if (design.buyingReasons.length === 0 && !design.buyingReasonBrief) return false;
  const name = typeof brief?.productName === "string" ? brief.productName.trim() : "";
  return name.length > 0;
}

export async function listProductDesignProjectSummaries(
  userId: string,
  module: EcomProjectModule = ECOM_PROJECT_MODULE_MAIN,
  opts?: { detailed?: boolean },
): Promise<EcomProductDesignProjectSummary[]> {
  const where = { userId, module: { in: projectModuleQueryValues(module) } };

  if (!opts?.detailed) {
    const rows = await productDesignProjects().findMany({
      where,
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

  const rows = await productDesignProjects().findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      title: true,
      platform: true,
      updatedAt: true,
      brief: true,
      references: true,
      design: true,
    },
  });
  return rows.map((row) => {
    const brief = (row.brief as Record<string, unknown> | null) ?? null;
    const design = parseProductDesign(row.design);
    return {
      id: row.id,
      title: row.title,
      platform: row.platform ?? DEFAULT_ECOM_PLATFORM_CODE,
      updatedAt: row.updatedAt.toISOString(),
      thumbnailUrl: firstProductRefUrl(row.references),
      productName:
        typeof brief?.productName === "string" && brief.productName.trim()
          ? brief.productName.trim()
          : null,
      mainImageCount: design?.mainImages.filter((m) => m.imageUrl).length ?? 0,
      strategyReady: isStrategySnapshotReady(brief, design),
    };
  });
}

function defaultProjectTitle(module: EcomProjectModule): string {
  return module === ECOM_PROJECT_MODULE_DETAIL ? "电商产品详情页创作" : "电商产品主图创作";
}

/** 建详情页项目时从主图项目搬运哪些内容 */
export type ProductDesignStrategyImport = {
  projectId: string;
  /** 搬运 role=product 的产品图 */
  productRefs: boolean;
  /** 把主图定稿成品作为详情页风格参考（role=detail-style） */
  mainImagesAsStyleRefs: boolean;
};

/** 主图成品最多带几张作为详情页风格参考，避免挤占参考图额度 */
const IMPORTED_STYLE_REF_MAX = 3;

type StrategySnapshot = {
  platform: string | null;
  brief: Record<string, unknown>;
  design: Partial<ProductDesign>;
  references: ProductDesignReference[];
  settings: Pick<
    ProductDesignSettings,
    "chatModelKey" | "imageModelKey" | "visionModelKey"
  >;
  sourceTitle: string | null;
};

/**
 * 读取源项目的 Step0–3 策略快照。
 * 只取策略层与产品图：出图产物（genPrompt / detailOutline / detailPages / imageGenPlans）
 * 与 chatHistory 都不搬，详情页项目要有自己干净的会话与产出。
 */
async function readStrategySnapshot(
  userId: string,
  input: ProductDesignStrategyImport,
): Promise<StrategySnapshot> {
  const source = await productDesignProjects().findFirst({
    where: { id: input.projectId, userId },
    select: {
      title: true,
      platform: true,
      brief: true,
      design: true,
      references: true,
      settings: true,
    },
  });
  if (!source) throw new Error("源项目不存在或无权访问");

  const design = parseProductDesign(source.design);
  const settings = (source.settings as ProductDesignSettings | null) ?? {};

  const references: ProductDesignReference[] = [];
  if (input.productRefs) {
    references.push(
      ...sanitizeProductDesignReferences(source.references).filter(
        (r) => r.role === "product",
      ),
    );
  }
  if (input.mainImagesAsStyleRefs && design) {
    const finals = design.mainImages
      .map((m) => m.imageUrl)
      .filter((url): url is string => Boolean(url))
      .slice(0, IMPORTED_STYLE_REF_MAX);
    references.push(
      ...finals.map((ossUrl, i) => ({
        id: `imported-main-${i + 1}`,
        label: `主图成品 ${i + 1}`,
        role: "detail-style" as const,
        ossUrl,
      })),
    );
  }

  return {
    platform: source.platform,
    brief: (source.brief as Record<string, unknown> | null) ?? {},
    design: design
      ? {
          analysis: design.analysis,
          marketingPlans: design.marketingPlans,
          selectedPlanNo: design.selectedPlanNo,
          buyingReasons: design.buyingReasons,
          buyingReasonBrief: design.buyingReasonBrief,
        }
      : {},
    references: sanitizeProductDesignReferences(references),
    settings: {
      chatModelKey: settings.chatModelKey,
      imageModelKey: settings.imageModelKey,
      visionModelKey: settings.visionModelKey,
    },
    sourceTitle: source.title,
  };
}

export async function createProductDesignProject(
  userId: string,
  opts?: {
    title?: string;
    platform?: string;
    brief?: Record<string, unknown>;
    module?: EcomProjectModule;
    importFrom?: ProductDesignStrategyImport;
  },
): Promise<EcomProductDesignProjectDto> {
  const module = opts?.module ?? ECOM_PROJECT_MODULE_MAIN;
  const snapshot = opts?.importFrom
    ? await readStrategySnapshot(userId, opts.importFrom)
    : null;

  const spec = getEcomPlatformSpec(
    opts?.platform ?? snapshot?.platform ?? DEFAULT_ECOM_PLATFORM_CODE,
  );
  const brief = { ...(snapshot?.brief ?? {}), ...(opts?.brief ?? {}) };
  const design = snapshot
    ? mergeProductDesign(null, snapshot.design)
    : null;
  const hasProductRef = (snapshot?.references ?? []).some((r) => r.role === "product");

  const row = await productDesignProjects().create({
    data: {
      userId,
      module,
      title: opts?.title?.trim().slice(0, 120) || defaultProjectTitle(module),
      platform: spec.code,
      brief: brief as Prisma.InputJsonValue,
      references: (snapshot?.references ?? []) as unknown as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      design: design
        ? (sanitizeAdCopyDeep(design).value as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      settings: {
        ...(snapshot?.settings ?? {}),
        mainImageCount: spec.mainImage.recommended,
        detailPageCount: spec.detailPage.recommended,
        mainImageRatio: spec.mainImage.ratio,
        detailPageRatio: spec.detailPage.ratio,
      } as Prisma.InputJsonValue,
      meta: (snapshot
        ? {
            // 已带产品图就直接进「选制作方式」，平台沿用源项目无需再确认
            setupPhase: hasProductRef ? "workflow-choice" : "product",
            platformConfirmed: true,
            importedFrom: {
              projectId: opts!.importFrom!.projectId,
              title: snapshot.sourceTitle,
              at: new Date().toISOString(),
            },
          }
        : { setupPhase: "product" }) as Prisma.InputJsonValue,
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
