/**
 * 全局资产库 · 跨应用聚合
 *
 * 与「素材抽屉」的区别：抽屉只列 `AiSpacePin`（用户手动收进空间的），
 * 本模块直接扫各应用源表，**无需先收藏** 就能看到全部已完成资产。
 *
 * 设计与性能约束见 doc/product/AI 空间功能设计文档.md §11。
 */

import { mapWithConcurrency } from "@/lib/generation/poll-parallel";
import { prisma } from "@/lib/prisma";

import {
  AI_SPACE_PIN_SOURCE_APP,
  AI_SPACE_PIN_SOURCE_LABEL,
  AI_SPACE_PIN_SOURCE_TYPES,
  isAiSpacePinSourceType,
  type AiSpacePinEntry,
  type AiSpacePinMediaKind,
  type AiSpacePinSourceType,
} from "./ai-space-pin-types";
import { listSourceAssets, sourceMediaKinds } from "./pin-resolvers";

/** 聚合项：展示字段与 Pin 卡片同构，另带「已收进空间 / 画布引用数」状态 */
export type AiSpaceLibraryAsset = {
  /** `${sourceType}:${sourceId}`，前端列表 key 与选中态用 */
  key: string;
  sourceApp: string;
  sourceType: AiSpacePinSourceType;
  sourceId: string;
  sourceLabel: string;
  resolved: AiSpacePinEntry["resolved"];
  /** 已收进空间（存在 AiSpacePin） */
  pinned: boolean;
  /** 已收进空间时的 Pin id，供「移出空间」直接调 DELETE */
  pinId: string | null;
  /** 在作品墙画布上的引用次数 */
  blockRefCount: number;
};

export type AiSpaceLibraryQuery = {
  kind?: AiSpacePinMediaKind | "all";
  /** 限定资产源；空数组或未传视为全部 */
  sources?: AiSpacePinSourceType[];
  keyword?: string | null;
  /** 单源扫描条数（越大越全，代价是响应体与解析成本） */
  perSource?: number;
};

export type AiSpaceLibraryPage = {
  items: AiSpaceLibraryAsset[];
  /** 各源在本次扫描窗口内的命中数，供筛选器显示计数 */
  sourceCounts: Record<string, number>;
  /** 达到单源上限，说明还有更早的资产没扫到 */
  truncatedSources: AiSpacePinSourceType[];
  scannedSources: number;
};

/**
 * 单源默认 24 条、总量 240 条。
 *
 * 14 个源全开时是 14 次轻量查询；并发压到 4 以内，避免打满连接池
 * （见 .cursor/rules/no-vpn-networking.mdc 与 docs/dev.md §数据库连接）。
 */
const DEFAULT_PER_SOURCE = 24;
const MAX_PER_SOURCE = 60;
const MAX_TOTAL_ITEMS = 240;
const SOURCE_SCAN_CONCURRENCY = 4;

export const AI_SPACE_LIBRARY_SOURCE_OPTIONS = AI_SPACE_PIN_SOURCE_TYPES.map(
  (sourceType) => ({
    sourceType,
    label: AI_SPACE_PIN_SOURCE_LABEL[sourceType],
    app: AI_SPACE_PIN_SOURCE_APP[sourceType],
    kinds: sourceMediaKinds(sourceType),
  }),
);

function normalizeSources(
  raw: AiSpacePinSourceType[] | undefined,
): AiSpacePinSourceType[] {
  if (!raw || raw.length === 0) return [...AI_SPACE_PIN_SOURCE_TYPES];
  const set = new Set(raw.filter(isAiSpacePinSourceType));
  return set.size > 0 ? [...set] : [...AI_SPACE_PIN_SOURCE_TYPES];
}

/** 聚合读：扫源 → 合并按时间倒序 → 附加收藏与画布引用状态 */
export async function listAiSpaceLibraryAssets(
  userId: string,
  query: AiSpaceLibraryQuery = {},
): Promise<AiSpaceLibraryPage> {
  const kind = query.kind && query.kind !== "all" ? query.kind : null;
  const perSource = Math.min(
    Math.max(1, query.perSource ?? DEFAULT_PER_SOURCE),
    MAX_PER_SOURCE,
  );
  const keyword = query.keyword?.trim() ? query.keyword.trim().slice(0, 60) : null;

  // 按形态筛选时整源跳过：音频筛选没必要去查图片源
  const sources = normalizeSources(query.sources).filter(
    (s) => !kind || sourceMediaKinds(s).includes(kind),
  );

  const collected: AiSpaceLibraryAsset[] = [];
  const truncatedSources: AiSpacePinSourceType[] = [];

  await mapWithConcurrency(
    sources,
    async (sourceType) => {
      try {
        const rows = await listSourceAssets({
          userId,
          sourceType,
          limit: perSource,
          keyword,
        });
        if (rows.length >= perSource) truncatedSources.push(sourceType);
        for (const row of rows) {
          if (kind && row.resolved.kind !== kind) continue;
          collected.push({
            key: `${sourceType}:${row.sourceId}`,
            sourceApp: AI_SPACE_PIN_SOURCE_APP[sourceType],
            sourceType,
            sourceId: row.sourceId,
            sourceLabel: AI_SPACE_PIN_SOURCE_LABEL[sourceType],
            resolved: row.resolved,
            pinned: false,
            pinId: null,
            blockRefCount: 0,
          });
        }
      } catch (e) {
        // 单源失败（表缺失、字段漂移）不应让整个资产库空白
        console.error("[ai-space] library source scan failed", { sourceType, e });
      }
    },
    SOURCE_SCAN_CONCURRENCY,
  );

  collected.sort((a, b) =>
    a.resolved.createdAt === b.resolved.createdAt
      ? a.key.localeCompare(b.key)
      : a.resolved.createdAt < b.resolved.createdAt
        ? 1
        : -1,
  );
  const items = collected.slice(0, MAX_TOTAL_ITEMS);

  await attachLibraryState(userId, items);

  const sourceCounts: Record<string, number> = {};
  for (const item of items) {
    sourceCounts[item.sourceType] = (sourceCounts[item.sourceType] ?? 0) + 1;
  }

  return {
    items,
    sourceCounts,
    truncatedSources,
    scannedSources: sources.length,
  };
}

/**
 * 附加「已收进空间」与「画布引用数」。
 * 两次查询覆盖全部条目，不做 N+1。
 */
async function attachLibraryState(
  userId: string,
  items: AiSpaceLibraryAsset[],
): Promise<void> {
  if (items.length === 0) return;
  const sourceIds = [...new Set(items.map((i) => i.sourceId))];

  const [pins, refs] = await Promise.all([
    prisma.aiSpacePin.findMany({
      where: { userId, sourceId: { in: sourceIds } },
      select: { id: true, sourceType: true, sourceId: true },
    }),
    prisma.aiSpaceBlockRef.findMany({
      where: { block: { userId }, sourceId: { in: sourceIds } },
      select: { sourceType: true, sourceId: true },
    }),
  ]);

  const pinIds = new Map(pins.map((p) => [`${p.sourceType}:${p.sourceId}`, p.id]));
  const refCounts = new Map<string, number>();
  for (const r of refs) {
    const key = `${r.sourceType}:${r.sourceId}`;
    refCounts.set(key, (refCounts.get(key) ?? 0) + 1);
  }

  for (const item of items) {
    item.pinId = pinIds.get(item.key) ?? null;
    item.pinned = item.pinId !== null;
    item.blockRefCount = refCounts.get(item.key) ?? 0;
  }
}
