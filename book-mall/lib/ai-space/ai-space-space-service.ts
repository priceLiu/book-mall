/**
 * 我的 AI 空间 · 自由画布服务
 *
 * 约束（doc/product/AI 空间功能设计文档.md）：
 * - 块只存指向；展示字段一律经 pin-resolvers 读时 resolve
 * - 块尺寸只能取五档之一，且必须在该挂件的 allowedTiers 内
 * - 套用模板只重排几何，不删除任何已有块
 * - 公开页剥离 launch 深链，并丢弃 launch_button 块
 */

import { prisma } from "@/lib/prisma";
import {
  AI_SPACE_PIN_SOURCE_APP,
  AI_SPACE_PIN_SOURCE_PUBLIC_SAFE,
  isAiSpacePinSourceType,
  type AiSpacePinSourceType,
} from "./ai-space-pin-types";
import type {
  AiSpaceBlockDto,
  AiSpaceBlockLayoutInput,
  AiSpaceBlockRefDto,
  AiSpaceBlockRefInput,
  AiSpacePageDto,
  AiSpacePublicPageDto,
} from "./ai-space-space-types";
import { resolvePinSources } from "./pin-resolvers";
import {
  buildTemplateBlocks,
  isSpacePageTemplateKey,
  type SpacePageTemplateKey,
} from "./space-blocks/page-templates";
import { planTemplateApply } from "./space-blocks/template-apply";
import {
  normalizeSpaceSizeTier,
  resolveTierLayout,
  SPACE_GRID_COLS,
  type SpaceSizeTierKey,
} from "./space-blocks/size-tiers";
import { parseSpacePageTheme, type SpacePageTheme } from "./space-blocks/theme";
import {
  getSpaceBlockDef,
  SPACE_PAGE_MAX_BLOCKS,
  SPACE_PAGE_MAX_REFS,
  type SpaceBlockDef,
  type SpaceBlockType,
} from "./space-blocks/types";

export class AiSpaceSpaceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AiSpaceSpaceError";
    this.code = code;
    this.status = status;
  }
}

export function isAiSpaceSpaceError(e: unknown): e is AiSpaceSpaceError {
  return e instanceof AiSpaceSpaceError;
}

// ---------------------------------------------------------------------------
// slug
// ---------------------------------------------------------------------------

/** 与 book-mall 现有一级路由冲突的名字，禁止占用 */
const RESERVED_SLUGS = new Set([
  "account",
  "admin",
  "api",
  "login",
  "register",
  "logout",
  "products",
  "product",
  "cart",
  "checkout",
  "pricing",
  "space",
  "new",
  "edit",
  "settings",
  "about",
  "help",
  "docs",
  "static",
  "public",
  "assets",
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export function assertValidSlug(slug: string): void {
  if (!SLUG_RE.test(slug)) {
    throw new AiSpaceSpaceError(
      "SLUG_INVALID",
      "链接名只能用小写字母、数字与连字符，长度 2–64",
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new AiSpaceSpaceError("SLUG_RESERVED", "该链接名已被系统保留");
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function slugifyBase(raw: string | null | undefined): string {
  const base = (raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return base.length >= 2 && !RESERVED_SLUGS.has(base) ? base : "space";
}

async function allocateSlug(seed: string | null): Promise<string> {
  const base = slugifyBase(seed);
  for (let i = 0; i < 6; i += 1) {
    const candidate = i === 0 ? `${base}-${randomSuffix()}` : `${base}-${randomSuffix()}`;
    const hit = await prisma.aiSpacePage.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!hit) return candidate;
  }
  return `space-${Date.now().toString(36)}-${randomSuffix()}`;
}

// ---------------------------------------------------------------------------
// 尺寸档位
// ---------------------------------------------------------------------------

/** 档位落到该挂件的白名单内；不允许则退回默认档位 */
function pickAllowedTier(
  def: SpaceBlockDef,
  desired: SpaceSizeTierKey,
): SpaceSizeTierKey {
  return def.allowedTiers.includes(desired) ? desired : def.defaultTier;
}

function geometryForTier(
  def: SpaceBlockDef,
  tier: SpaceSizeTierKey,
): { w: number; h: number } {
  return resolveTierLayout(tier, def.maxH);
}

// ---------------------------------------------------------------------------
// 页面
// ---------------------------------------------------------------------------

const pageSelect = {
  id: true,
  userId: true,
  slug: true,
  title: true,
  bio: true,
  templateKey: true,
  theme: true,
  publishStatus: true,
  publishedAt: true,
} as const;

const blockSelect = {
  id: true,
  blockType: true,
  sizeTier: true,
  layoutX: true,
  layoutY: true,
  layoutW: true,
  layoutH: true,
  layoutZ: true,
  mobileOrder: true,
  config: true,
  content: true,
  refs: {
    select: {
      id: true,
      sourceApp: true,
      sourceType: true,
      sourceId: true,
      slotKey: true,
      caption: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  },
} as const;

/**
 * 取当前用户的空间页；首次访问时自动建页并套用默认模板（BENTO）。
 * 并发下 unique(userId) 冲突时回读，保持幂等。
 */
export async function getOrCreateSpacePage(userId: string): Promise<string> {
  const existing = await prisma.aiSpacePage.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const seed = user?.name ?? user?.email?.split("@")[0] ?? null;
  const slug = await allocateSlug(seed);

  try {
    const page = await prisma.aiSpacePage.create({
      data: { userId, slug, title: user?.name ? `${user.name} 的 AI 空间` : "我的 AI 空间" },
      select: { id: true },
    });
    await seedTemplateBlocks(page.id, userId, "BENTO");
    return page.id;
  } catch {
    const again = await prisma.aiSpacePage.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (again) return again.id;
    throw new AiSpaceSpaceError("PAGE_CREATE_FAILED", "空间页创建失败", 500);
  }
}

/** 新页初始化：把模板骨架写成空槽位块 */
async function seedTemplateBlocks(
  pageId: string,
  userId: string,
  key: SpacePageTemplateKey,
): Promise<void> {
  const blocks = buildTemplateBlocks(key);
  if (blocks.length === 0) return;
  await prisma.aiSpaceBlock.createMany({
    data: blocks.map((b) => ({
      pageId,
      userId,
      blockType: b.blockType,
      sizeTier: b.sizeTier,
      layoutX: b.layoutX,
      layoutY: b.layoutY,
      layoutW: b.layoutW,
      layoutH: b.layoutH,
      mobileOrder: b.mobileOrder,
      config: b.config as object,
      content: b.content ?? undefined,
    })),
  });
}

type PageRow = {
  id: string;
  userId: string;
  slug: string;
  title: string;
  bio: string;
  templateKey: string;
  theme: unknown;
  publishStatus: string;
  publishedAt: Date | null;
};

type BlockRow = {
  id: string;
  blockType: string;
  sizeTier: string;
  layoutX: number;
  layoutY: number;
  layoutW: number;
  layoutH: number;
  layoutZ: number;
  mobileOrder: number;
  config: unknown;
  content: unknown;
  refs: {
    id: string;
    sourceApp: string;
    sourceType: string;
    sourceId: string;
    slotKey: string;
    caption: string | null;
    sortOrder: number;
  }[];
};

function parseContentValue(raw: unknown): { text: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const text = (raw as Record<string, unknown>).text;
  return typeof text === "string" ? { text } : null;
}

/** 组装块 DTO：批量 resolve 所有 ref 的展示字段 */
async function assembleBlocks(
  ownerUserId: string,
  rows: BlockRow[],
): Promise<AiSpaceBlockDto[]> {
  const refPairs: { sourceType: AiSpacePinSourceType; sourceId: string }[] = [];
  for (const row of rows) {
    for (const ref of row.refs) {
      if (isAiSpacePinSourceType(ref.sourceType)) {
        refPairs.push({ sourceType: ref.sourceType, sourceId: ref.sourceId });
      }
    }
  }

  const resolved =
    refPairs.length > 0
      ? await resolvePinSources(ownerUserId, refPairs)
      : new Map<string, never>();

  const out: AiSpaceBlockDto[] = [];
  for (const row of rows) {
    const def = getSpaceBlockDef(row.blockType);
    // 未知 blockType（回滚旧版本等）：跳过而非炸页
    if (!def) continue;

    const refs: AiSpaceBlockRefDto[] = row.refs.map((ref) => ({
      id: ref.id,
      sourceApp: ref.sourceApp,
      sourceType: ref.sourceType as AiSpacePinSourceType,
      sourceId: ref.sourceId,
      slotKey: ref.slotKey,
      caption: ref.caption,
      sortOrder: ref.sortOrder,
      resolved: resolved.get(`${ref.sourceType}:${ref.sourceId}`) ?? null,
    }));

    out.push({
      id: row.id,
      blockType: def.type,
      sizeTier: normalizeSpaceSizeTier(row.sizeTier),
      layoutX: row.layoutX,
      layoutY: row.layoutY,
      layoutW: row.layoutW,
      layoutH: row.layoutH,
      layoutZ: row.layoutZ,
      mobileOrder: row.mobileOrder,
      config: def.parseConfig(row.config) as unknown as Record<string, unknown>,
      content: def.parseContent(parseContentValue(row.content) ?? {}),
      refs,
    });
  }
  return out;
}

function toPageDto(page: PageRow, blocks: AiSpaceBlockDto[]): AiSpacePageDto {
  return {
    id: page.id,
    slug: page.slug,
    title: page.title,
    bio: page.bio,
    templateKey: (isSpacePageTemplateKey(page.templateKey)
      ? page.templateKey
      : "BENTO") as SpacePageTemplateKey,
    theme: parseSpacePageTheme(page.theme),
    publishStatus: page.publishStatus === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    publishedAt: page.publishedAt?.toISOString() ?? null,
    blocks,
  };
}

/** 编辑态：本人查看自己的空间页（含未填资产的空槽位） */
export async function getSpacePageForOwner(
  userId: string,
): Promise<AiSpacePageDto> {
  const pageId = await getOrCreateSpacePage(userId);
  const page = await prisma.aiSpacePage.findUnique({
    where: { id: pageId },
    select: pageSelect,
  });
  if (!page) {
    throw new AiSpaceSpaceError("PAGE_NOT_FOUND", "空间页不存在", 404);
  }
  const rows = await prisma.aiSpaceBlock.findMany({
    where: { pageId },
    orderBy: [{ layoutY: "asc" }, { layoutX: "asc" }],
    select: blockSelect,
  });
  const blocks = await assembleBlocks(userId, rows as BlockRow[]);
  return toPageDto(page as PageRow, blocks);
}

/** 公开页：只返回已发布，剥离 launch 深链并丢弃 launch_button 块 */
export async function getPublicSpaceBySlug(
  slug: string,
): Promise<AiSpacePublicPageDto | null> {
  const page = await prisma.aiSpacePage.findUnique({
    where: { slug },
    select: { ...pageSelect, user: { select: { name: true } } },
  });
  if (!page || page.publishStatus !== "PUBLISHED") return null;

  const rows = await prisma.aiSpaceBlock.findMany({
    where: { pageId: page.id },
    orderBy: [{ layoutY: "asc" }, { layoutX: "asc" }],
    select: blockSelect,
  });
  const blocks = await assembleBlocks(page.userId, rows as BlockRow[]);

  const publicBlocks = blocks
    // 继续创作是 SSO 深链，只对本人有意义
    .filter((b) => b.blockType !== "launch_button")
    .map((b) => ({
      ...b,
      refs: b.refs.map((r) => ({
        ...r,
        resolved:
          // 媒体走 Book 鉴权代理的素材（如 AI 试衣模特）访客拿不到，按已删除渲染占位
          r.resolved && AI_SPACE_PIN_SOURCE_PUBLIC_SAFE[r.sourceType]
            ? { ...r.resolved, launch: null }
            : null,
      })),
    }));

  return {
    ...toPageDto(page as PageRow, publicBlocks),
    ownerDisplayName: page.user?.name ?? null,
  };
}

/** 改页面元信息 */
export async function updateSpacePage(
  userId: string,
  patch: {
    title?: string;
    bio?: string;
    slug?: string;
    theme?: unknown;
  },
): Promise<AiSpacePageDto> {
  const pageId = await getOrCreateSpacePage(userId);

  const data: {
    title?: string;
    bio?: string;
    slug?: string;
    theme?: SpacePageTheme;
  } = {};

  if (typeof patch.title === "string") {
    const title = patch.title.trim().slice(0, 120);
    if (!title) {
      throw new AiSpaceSpaceError("TITLE_REQUIRED", "空间标题不能为空");
    }
    data.title = title;
  }
  if (typeof patch.bio === "string") data.bio = patch.bio.slice(0, 2000);
  if (patch.theme !== undefined) data.theme = parseSpacePageTheme(patch.theme);

  if (typeof patch.slug === "string") {
    const slug = patch.slug.trim().toLowerCase();
    assertValidSlug(slug);
    const taken = await prisma.aiSpacePage.findFirst({
      where: { slug, NOT: { id: pageId } },
      select: { id: true },
    });
    if (taken) {
      throw new AiSpaceSpaceError("SLUG_TAKEN", "该链接名已被占用", 409);
    }
    data.slug = slug;
  }

  if (Object.keys(data).length > 0) {
    await prisma.aiSpacePage.update({ where: { id: pageId }, data });
  }
  return getSpacePageForOwner(userId);
}

/** 发布 / 取消发布 */
export async function publishSpacePage(
  userId: string,
  publish: boolean,
): Promise<AiSpacePageDto> {
  const pageId = await getOrCreateSpacePage(userId);
  await prisma.aiSpacePage.update({
    where: { id: pageId },
    data: {
      publishStatus: publish ? "PUBLISHED" : "DRAFT",
      publishedAt: publish ? new Date() : null,
    },
  });
  return getSpacePageForOwner(userId);
}

/**
 * 套用整页模板：**只重排几何，不删块**。
 *
 * 排版计算全部在 planTemplateApply 里（纯函数，见 space-blocks/template-apply.ts）：
 * 已有块按 **块类型** 认领同类槽位，认领不到的追加到版式下方，
 * 空出来的槽位补建为空槽位，最后统一回流保证任意两块不重叠。
 */
export async function applySpaceTemplate(
  userId: string,
  key: SpacePageTemplateKey,
): Promise<AiSpacePageDto> {
  const pageId = await getOrCreateSpacePage(userId);

  const existing = await prisma.aiSpaceBlock.findMany({
    where: { pageId },
    orderBy: [{ mobileOrder: "asc" }, { layoutY: "asc" }, { layoutX: "asc" }],
    select: { id: true, blockType: true },
  });

  const placements = planTemplateApply(
    key,
    existing.flatMap((row) =>
      getSpaceBlockDef(row.blockType)
        ? [{ id: row.id, blockType: row.blockType as SpaceBlockType }]
        : [],
    ),
  );

  const room = Math.max(0, SPACE_PAGE_MAX_BLOCKS - existing.length);
  let created = 0;

  const updates = [];
  const creates: {
    pageId: string;
    userId: string;
    blockType: string;
    sizeTier: string;
    layoutX: number;
    layoutY: number;
    layoutW: number;
    layoutH: number;
    mobileOrder: number;
    config: object;
    content?: object;
  }[] = [];

  for (const p of placements) {
    if (p.id) {
      updates.push(
        prisma.aiSpaceBlock.update({
          where: { id: p.id },
          data: {
            sizeTier: p.sizeTier,
            layoutX: p.layoutX,
            layoutY: p.layoutY,
            layoutW: p.layoutW,
            layoutH: p.layoutH,
            mobileOrder: p.mobileOrder,
          },
        }),
      );
      continue;
    }
    if (created >= room) continue;
    created += 1;
    creates.push({
      pageId,
      userId,
      blockType: p.blockType,
      sizeTier: p.sizeTier,
      layoutX: p.layoutX,
      layoutY: p.layoutY,
      layoutW: p.layoutW,
      layoutH: p.layoutH,
      mobileOrder: p.mobileOrder,
      config: (p.config ?? {}) as object,
      content: p.content ?? undefined,
    });
  }

  await prisma.$transaction([
    ...updates,
    ...(creates.length > 0
      ? [prisma.aiSpaceBlock.createMany({ data: creates })]
      : []),
    prisma.aiSpacePage.update({
      where: { id: pageId },
      data: { templateKey: key },
    }),
  ]);

  return getSpacePageForOwner(userId);
}

// ---------------------------------------------------------------------------
// 块
// ---------------------------------------------------------------------------

/** 校验 ref 归属与媒体形态，返回规范化后的 ref 列表 */
async function normalizeRefs(
  userId: string,
  def: SpaceBlockDef,
  inputs: AiSpaceBlockRefInput[],
): Promise<
  {
    sourceApp: string;
    sourceType: AiSpacePinSourceType;
    sourceId: string;
    slotKey: string;
    caption: string | null;
    sortOrder: number;
  }[]
> {
  if (inputs.length === 0) return [];
  if (inputs.length > def.refs.max) {
    throw new AiSpaceSpaceError(
      "REFS_TOO_MANY",
      `「${def.label}」最多引用 ${def.refs.max} 个素材`,
    );
  }

  const slotKeys = def.slots?.map((s) => s.key) ?? null;
  const pairs: { sourceType: AiSpacePinSourceType; sourceId: string }[] = [];
  for (const input of inputs) {
    if (!isAiSpacePinSourceType(input.sourceType)) {
      throw new AiSpaceSpaceError("SOURCE_TYPE_INVALID", "不支持的素材类型");
    }
    if (!input.sourceId) {
      throw new AiSpaceSpaceError("SOURCE_ID_REQUIRED", "缺少素材 id");
    }
    pairs.push({ sourceType: input.sourceType, sourceId: input.sourceId });
  }

  const resolved = await resolvePinSources(userId, pairs);

  return inputs.map((input, index) => {
    const sourceType = input.sourceType;
    const hit = resolved.get(`${sourceType}:${input.sourceId}`);
    if (!hit) {
      throw new AiSpaceSpaceError("SOURCE_NOT_FOUND", "素材不存在或无权引用", 404);
    }
    if (def.acceptKinds && !def.acceptKinds.includes(hit.kind)) {
      throw new AiSpaceSpaceError(
        "KIND_MISMATCH",
        `「${def.label}」只能放${def.acceptKinds.join(" / ")}类素材`,
      );
    }
    const slotKey = input.slotKey?.trim() ?? "";
    if (slotKeys && slotKey && !slotKeys.includes(slotKey)) {
      throw new AiSpaceSpaceError("SLOT_INVALID", "槽位无效");
    }
    return {
      sourceApp: input.sourceApp?.trim() || AI_SPACE_PIN_SOURCE_APP[sourceType],
      sourceType,
      sourceId: input.sourceId,
      slotKey: slotKeys ? slotKey || slotKeys[Math.min(index, slotKeys.length - 1)] : "",
      caption: input.caption?.trim().slice(0, 200) || null,
      sortOrder: index,
    };
  });
}

async function assertPageCapacity(
  pageId: string,
  addBlocks: number,
  addRefs: number,
): Promise<void> {
  const [blockCount, refCount] = await Promise.all([
    prisma.aiSpaceBlock.count({ where: { pageId } }),
    prisma.aiSpaceBlockRef.count({ where: { block: { pageId } } }),
  ]);
  if (blockCount + addBlocks > SPACE_PAGE_MAX_BLOCKS) {
    throw new AiSpaceSpaceError(
      "BLOCKS_LIMIT",
      `单页最多 ${SPACE_PAGE_MAX_BLOCKS} 个块`,
    );
  }
  if (refCount + addRefs > SPACE_PAGE_MAX_REFS) {
    throw new AiSpaceSpaceError(
      "REFS_LIMIT",
      `单页最多引用 ${SPACE_PAGE_MAX_REFS} 个素材`,
    );
  }
}

/** 找一个不与现有块重叠的落点（简单向下追加） */
async function nextFreeRow(pageId: string): Promise<number> {
  const agg = await prisma.aiSpaceBlock.findMany({
    where: { pageId },
    select: { layoutY: true, layoutH: true },
  });
  return agg.reduce((max, b) => Math.max(max, b.layoutY + b.layoutH), 0);
}

export async function createSpaceBlock(
  userId: string,
  input: {
    blockType: string;
    sizeTier?: string;
    config?: unknown;
    content?: unknown;
    refs?: AiSpaceBlockRefInput[];
    layoutX?: number;
    layoutY?: number;
  },
): Promise<AiSpaceBlockDto> {
  const def = getSpaceBlockDef(input.blockType);
  if (!def) {
    throw new AiSpaceSpaceError("BLOCK_TYPE_INVALID", "不支持的挂件类型");
  }

  const pageId = await getOrCreateSpacePage(userId);
  const refs = await normalizeRefs(userId, def, input.refs ?? []);
  await assertPageCapacity(pageId, 1, refs.length);

  const tier = pickAllowedTier(def, normalizeSpaceSizeTier(input.sizeTier ?? def.defaultTier));
  const { w, h } = geometryForTier(def, tier);
  const layoutX =
    typeof input.layoutX === "number"
      ? Math.min(Math.max(0, Math.round(input.layoutX)), SPACE_GRID_COLS - w)
      : 0;
  const layoutY =
    typeof input.layoutY === "number"
      ? Math.max(0, Math.round(input.layoutY))
      : await nextFreeRow(pageId);

  const created = await prisma.aiSpaceBlock.create({
    data: {
      pageId,
      userId,
      blockType: def.type,
      sizeTier: tier,
      layoutX,
      layoutY,
      layoutW: w,
      layoutH: h,
      mobileOrder: layoutY,
      config: def.parseConfig(input.config ?? {}) as object,
      content: def.parseContent(input.content ?? {}) ?? undefined,
      refs: refs.length > 0 ? { create: refs } : undefined,
    },
    select: blockSelect,
  });

  const [dto] = await assembleBlocks(userId, [created as BlockRow]);
  if (!dto) {
    throw new AiSpaceSpaceError("BLOCK_ASSEMBLE_FAILED", "块创建后读取失败", 500);
  }
  return dto;
}

export async function updateSpaceBlock(
  userId: string,
  input: {
    id: string;
    sizeTier?: string;
    config?: unknown;
    content?: unknown;
    /** 传入即整体替换该块的 refs */
    refs?: AiSpaceBlockRefInput[];
  },
): Promise<AiSpaceBlockDto> {
  const row = await prisma.aiSpaceBlock.findFirst({
    where: { id: input.id, userId },
    select: { id: true, pageId: true, blockType: true, config: true, content: true },
  });
  if (!row) {
    throw new AiSpaceSpaceError("BLOCK_NOT_FOUND", "块不存在", 404);
  }
  const def = getSpaceBlockDef(row.blockType);
  if (!def) {
    throw new AiSpaceSpaceError("BLOCK_TYPE_INVALID", "不支持的挂件类型");
  }

  const data: Record<string, unknown> = {};

  if (input.sizeTier !== undefined) {
    const tier = pickAllowedTier(def, normalizeSpaceSizeTier(input.sizeTier));
    const { w, h } = geometryForTier(def, tier);
    data.sizeTier = tier;
    data.layoutW = w;
    data.layoutH = h;
  }
  if (input.config !== undefined) {
    data.config = def.parseConfig(input.config) as object;
  }
  if (input.content !== undefined) {
    data.content = def.parseContent(input.content) ?? undefined;
  }

  let nextRefs: Awaited<ReturnType<typeof normalizeRefs>> | null = null;
  if (input.refs !== undefined) {
    nextRefs = await normalizeRefs(userId, def, input.refs);
    const currentCount = await prisma.aiSpaceBlockRef.count({
      where: { blockId: row.id },
    });
    await assertPageCapacity(
      row.pageId,
      0,
      Math.max(0, nextRefs.length - currentCount),
    );
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.aiSpaceBlock.update({ where: { id: row.id }, data });
    }
    if (nextRefs) {
      await tx.aiSpaceBlockRef.deleteMany({ where: { blockId: row.id } });
      if (nextRefs.length > 0) {
        await tx.aiSpaceBlockRef.createMany({
          data: nextRefs.map((r) => ({ ...r, blockId: row.id })),
        });
      }
    }
  });

  const fresh = await prisma.aiSpaceBlock.findUnique({
    where: { id: row.id },
    select: blockSelect,
  });
  const [dto] = await assembleBlocks(userId, [fresh as BlockRow]);
  if (!dto) {
    throw new AiSpaceSpaceError("BLOCK_ASSEMBLE_FAILED", "块更新后读取失败", 500);
  }
  return dto;
}

/** 删块：只影响画布排布，源素材与 Pin 都不动 */
export async function deleteSpaceBlock(
  userId: string,
  blockId: string,
): Promise<void> {
  const res = await prisma.aiSpaceBlock.deleteMany({
    where: { id: blockId, userId },
  });
  if (res.count === 0) {
    throw new AiSpaceSpaceError("BLOCK_NOT_FOUND", "块不存在", 404);
  }
}

/** 拖拽结束后批量存坐标；宽高仍以档位为准，防止前端绕过档位约束 */
export async function saveSpaceLayout(
  userId: string,
  items: AiSpaceBlockLayoutInput[],
): Promise<void> {
  if (items.length === 0) return;
  if (items.length > SPACE_PAGE_MAX_BLOCKS) {
    throw new AiSpaceSpaceError("BLOCKS_LIMIT", "布局条目过多");
  }

  const owned = await prisma.aiSpaceBlock.findMany({
    where: { userId, id: { in: items.map((i) => i.id) } },
    select: { id: true, blockType: true, sizeTier: true },
  });
  const byId = new Map(owned.map((r) => [r.id, r]));

  const updates = [];
  for (const item of items) {
    const row = byId.get(item.id);
    if (!row) continue;
    const def = getSpaceBlockDef(row.blockType);
    if (!def) continue;
    const { w, h } = geometryForTier(def, normalizeSpaceSizeTier(row.sizeTier));
    updates.push(
      prisma.aiSpaceBlock.update({
        where: { id: item.id },
        data: {
          layoutX: Math.min(Math.max(0, Math.round(item.layoutX)), SPACE_GRID_COLS - w),
          layoutY: Math.max(0, Math.round(item.layoutY)),
          layoutW: w,
          layoutH: h,
          mobileOrder: Math.max(0, Math.round(item.mobileOrder)),
        },
      }),
    );
  }
  if (updates.length > 0) await prisma.$transaction(updates);
}

export type { SpaceBlockType };
