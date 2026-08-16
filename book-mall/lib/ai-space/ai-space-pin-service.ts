/**
 * 我的 AI 空间 · Pin 服务
 *
 * 约束（doc/product/我的AI空间.md §3.1）：
 * - Pin 只存指向；展示字段由 pin-resolvers 读时组装
 * - 删源必须调 cascadeDeletePinsBySource，不留孤儿 Pin
 * - 空间内「取消展示」只删 Pin，不动源记录
 */

import { prisma } from "@/lib/prisma";
import {
  AI_SPACE_PIN_SOURCE_APP,
  type AiSpacePinCheckResult,
  type AiSpacePinEntry,
  type AiSpacePinSourceType,
} from "./ai-space-pin-types";
import { cascadeDeleteBlockRefsBySource } from "./ai-space-space-refs";
import { assertPinSourceOwned, resolvePinSources } from "./pin-resolvers";

const LIST_LIMIT = 200;

export class AiSpacePinError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AiSpacePinError";
    this.code = code;
    this.status = status;
  }
}

export function isAiSpacePinError(e: unknown): e is AiSpacePinError {
  return e instanceof AiSpacePinError;
}

/** 作品墙列表：按 sortOrder 升序、同序按创建时间倒序 */
export async function listPins(
  userId: string,
  opts?: { sourceType?: AiSpacePinSourceType; limit?: number },
): Promise<AiSpacePinEntry[]> {
  const rows = await prisma.aiSpacePin.findMany({
    where: {
      userId,
      ...(opts?.sourceType ? { sourceType: opts.sourceType } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: Math.min(opts?.limit ?? LIST_LIMIT, LIST_LIMIT),
  });
  if (rows.length === 0) return [];

  const resolved = await resolvePinSources(
    userId,
    rows.map((r) => ({
      sourceType: r.sourceType as AiSpacePinSourceType,
      sourceId: r.sourceId,
    })),
  );

  const entries: AiSpacePinEntry[] = [];
  for (const r of rows) {
    const hit = resolved.get(`${r.sourceType}:${r.sourceId}`);
    // 源已消失（理论上 cascade 已处理）：静默跳过，不返回半空卡片
    if (!hit) continue;
    entries.push({
      pinId: r.id,
      sourceApp: r.sourceApp,
      sourceType: r.sourceType as AiSpacePinSourceType,
      sourceId: r.sourceId,
      sortOrder: r.sortOrder,
      caption: r.caption ?? null,
      pinnedAt: r.createdAt.toISOString(),
      resolved: hit,
    });
  }
  return entries;
}

/** 展示到作品墙。重复 Pin 视为幂等成功。 */
export async function createPin(args: {
  userId: string;
  sourceType: AiSpacePinSourceType;
  sourceId: string;
  sourceApp?: string;
  caption?: string | null;
}): Promise<{ pinId: string; created: boolean }> {
  const { userId, sourceType, sourceId } = args;

  const owned = await assertPinSourceOwned(userId, sourceType, sourceId);
  if (!owned) {
    throw new AiSpacePinError("SOURCE_NOT_FOUND", "作品不存在或无权展示", 404);
  }

  const existing = await prisma.aiSpacePin.findUnique({
    where: { userId_sourceType_sourceId: { userId, sourceType, sourceId } },
    select: { id: true },
  });
  if (existing) return { pinId: existing.id, created: false };

  const maxOrder = await prisma.aiSpacePin.aggregate({
    where: { userId },
    _max: { sortOrder: true },
  });

  const caption = args.caption?.trim().slice(0, 200) || null;
  const row = await prisma.aiSpacePin.create({
    data: {
      userId,
      sourceApp: args.sourceApp?.trim() || AI_SPACE_PIN_SOURCE_APP[sourceType],
      sourceType,
      sourceId,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      caption,
    },
    select: { id: true },
  });
  return { pinId: row.id, created: true };
}

/** 取消展示：只删 Pin，源作品保留 */
export async function deletePin(userId: string, pinId: string): Promise<void> {
  const res = await prisma.aiSpacePin.deleteMany({ where: { id: pinId, userId } });
  if (res.count === 0) {
    throw new AiSpacePinError("PIN_NOT_FOUND", "展示项不存在", 404);
  }
}

/** 改展示标题 */
export async function updatePinCaption(
  userId: string,
  pinId: string,
  caption: string | null,
): Promise<void> {
  const res = await prisma.aiSpacePin.updateMany({
    where: { id: pinId, userId },
    data: { caption: caption?.trim().slice(0, 200) || null },
  });
  if (res.count === 0) {
    throw new AiSpacePinError("PIN_NOT_FOUND", "展示项不存在", 404);
  }
}

/** 布置顺序：按传入 pinId 数组重排 */
export async function reorderPins(
  userId: string,
  pinIds: string[],
): Promise<void> {
  const owned = await prisma.aiSpacePin.findMany({
    where: { userId, id: { in: pinIds } },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((r) => r.id));
  const ordered = pinIds.filter((id) => ownedIds.has(id));
  if (ordered.length === 0) return;

  await prisma.$transaction(
    ordered.map((id, index) =>
      prisma.aiSpacePin.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );
}

/**
 * 删源前检测：该源记录是否已展示在作品墙。
 * 前端据此在二次确认文案中提示「个人空间展示将一并移除」。
 */
export async function checkPins(args: {
  userId: string;
  sourceType: AiSpacePinSourceType;
  sourceIds: string[];
}): Promise<Record<string, AiSpacePinCheckResult>> {
  const rows = await prisma.aiSpacePin.findMany({
    where: {
      userId: args.userId,
      sourceType: args.sourceType,
      sourceId: { in: args.sourceIds },
    },
    select: { id: true, sourceId: true },
  });

  const out: Record<string, AiSpacePinCheckResult> = {};
  for (const id of args.sourceIds) {
    out[id] = { pinned: false, pinIds: [] };
  }
  for (const r of rows) {
    const entry = out[r.sourceId];
    if (!entry) continue;
    entry.pinned = true;
    entry.pinIds.push(r.id);
  }
  return out;
}

/**
 * 删源时级联删 Pin **与画布块引用**。
 * **必须在删除源 DB 记录前后调用**（同事务外亦可，幂等）。
 * 不校验 userId 归属：源记录所有权已由调用方校验，管理后台旁路也要能清干净。
 *
 * 画布块本身 **不删**：只清 AiSpaceBlockRef，块留下渲染「素材已删除」占位，
 * 避免删一张图导致整页布局塌陷（见 doc/product/AI 空间功能设计文档.md §7.1）。
 */
export async function cascadeDeletePinsBySource(
  sourceType: AiSpacePinSourceType,
  sourceIds: string | string[],
): Promise<number> {
  const ids = (Array.isArray(sourceIds) ? sourceIds : [sourceIds]).filter(
    (v) => typeof v === "string" && v.length > 0,
  );
  if (ids.length === 0) return 0;

  await cascadeDeleteBlockRefsBySource(sourceType, ids);

  try {
    const res = await prisma.aiSpacePin.deleteMany({
      where: { sourceType, sourceId: { in: ids } },
    });
    return res.count;
  } catch (e) {
    // Pin 清理失败不应阻断源删除；记录后放行，由后续 resolve 兜底跳过
    console.error("[ai-space] cascadeDeletePinsBySource failed", {
      sourceType,
      ids,
      e,
    });
    return 0;
  }
}
