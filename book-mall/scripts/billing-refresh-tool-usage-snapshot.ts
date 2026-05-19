/**
 * v005（2026-05-17）：根据最新 `ToolBillablePrice` 命中行 + 最新 `ModelCatalog/ModelAlias`，
 * 重写历史 `ToolBillingDetailLine`（source=TOOL_USAGE_GENERATED）的 cloudRow JSON。
 *
 * 旧版本（v002~v004）此脚本同时回填 `internalCloudCostUnitYuan / internalRetailMultiplier /
 * internalOurUnitYuan / internalFormulaText` 四个 DB Decimal 列，v005 schema 把 internal* 7 列删了，
 * 价格快照统一存在 cloudRow 内的「平台/系数(M) + 平台/定价 + 平台/扣点」键里。
 *
 * 安全性：
 *   - 幂等：每次 SET 为最新快照；不写多行。
 *   - 不动 ToolBillingDetailLine.createdAt 与 cloudRow 内"账单时间组"——这些是"当时事实"，
 *     只刷新"对内计价/产品命名"等元信息。
 *   - 默认按 user 范围（BILLING_REFRESH_USER_ID=<id>）/ 全量；--dry 试跑模式。
 *
 * 用法：
 *   pnpm tsx scripts/billing-refresh-tool-usage-snapshot.ts            # 全量
 *   BILLING_REFRESH_USER_ID=<id> pnpm tsx scripts/billing-refresh-tool-usage-snapshot.ts
 *   pnpm tsx scripts/billing-refresh-tool-usage-snapshot.ts --dry      # 试跑（不写库）
 */
import { Prisma, ModelAliasSource } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveBillableSnapshot } from "../lib/tool-billable-price";
import {
  buildToolUsageBillingLineData,
  type ToolUsagePricingSnapshot,
  type ToolUsageUserHint,
  type ToolUsageCanonicalHint,
} from "../lib/finance/tool-usage-billing-line";

const BATCH = 200;
const DRY = process.argv.includes("--dry");

/** v005：refresh 时也注入「平台/用户ID + 用户名」——按 userId 缓存避免重复查 User。 */
const userHintCache = new Map<string, ToolUsageUserHint>();
async function userHintFor(userId: string): Promise<ToolUsageUserHint> {
  const cached = userHintCache.get(userId);
  if (cached) return cached;
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  const hint: ToolUsageUserHint = u
    ? { userId: u.id, userLabel: u.name?.trim() || u.email?.trim() || u.id }
    : { userId, userLabel: userId };
  userHintCache.set(userId, hint);
  return hint;
}

function extractSchemeARefModelKey(meta: unknown): string | undefined {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return undefined;
  const m = meta as Record<string, unknown>;
  const candidates = ["modelId", "apiModel", "tryOnModel", "videoModel", "textToImageModel"];
  for (const k of candidates) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * v006 Round 4 修复：refresh-snapshot 以前没传 canonical 给 buildCloudRowFromUsage，
 * 导致 cloudRow 里「平台/产品Code」回退成 toolKey、「厂商产品/*」5 列全空。
 *
 * 现在和 `recordToolUsageAndConsumeWallet.resolveCanonicalFromMeta` 同口径反查 ModelCatalog 5 个 vendor* 字段。
 */
async function resolveCanonicalForRefresh(
  meta: unknown,
): Promise<ToolUsageCanonicalHint | null> {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const m = meta as Record<string, unknown>;
  const cand: string[] = [];
  for (const k of ["modelId", "tryOnModel", "videoModel", "textToImageModel", "apiModel"]) {
    const v = m[k];
    if (typeof v === "string" && v.trim()) cand.push(v.trim());
  }
  if (cand.length === 0) return null;
  const hit = await prisma.modelAlias.findFirst({
    where: {
      active: true,
      source: ModelAliasSource.INTERNAL_SCHEME_A_MODEL,
      aliasValue: { in: cand },
      catalog: { active: true },
    },
    select: {
      catalog: {
        select: {
          canonicalKey: true,
          displayName: true,
          vendor: true,
          vendorProductName: true,
          vendorCommodityCode: true,
          vendorCommodityName: true,
          vendorBillableItemCode: true,
          vendorBillableItemName: true,
        },
      },
    },
  });
  if (!hit?.catalog) return null;
  return {
    canonicalKey: hit.catalog.canonicalKey,
    displayName: hit.catalog.displayName,
    vendor: hit.catalog.vendor,
    vendorProductName: hit.catalog.vendorProductName,
    vendorCommodityCode: hit.catalog.vendorCommodityCode,
    vendorCommodityName: hit.catalog.vendorCommodityName,
    vendorBillableItemCode: hit.catalog.vendorBillableItemCode,
    vendorBillableItemName: hit.catalog.vendorBillableItemName,
  };
}

type ScanLine = {
  id: string;
  userId: string;
  toolUsageEventId: string | null;
};

async function main() {
  const userIdFilter = process.env.BILLING_REFRESH_USER_ID?.trim() || undefined;

  let scanned = 0;
  let updated = 0;
  let skippedNoSnapshot = 0;
  let skippedNoEvent = 0;
  let cursor: string | null = null;

  console.log(
    `[refresh-snapshot] start; filter=${userIdFilter ?? "all"}; dry=${DRY}`,
  );

  for (;;) {
    const lines: ScanLine[] = await prisma.toolBillingDetailLine.findMany({
      where: {
        source: "TOOL_USAGE_GENERATED",
        ...(userIdFilter ? { userId: userIdFilter } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userId: true,
        toolUsageEventId: true,
      },
    });

    if (lines.length === 0) break;
    scanned += lines.length;

    const eventIds = lines
      .map((l) => l.toolUsageEventId)
      .filter((v): v is string => !!v);
    const events = eventIds.length
      ? await prisma.toolUsageEvent.findMany({
          where: { id: { in: eventIds } },
          select: {
            id: true,
            userId: true,
            toolKey: true,
            action: true,
            costPoints: true,
            meta: true,
            createdAt: true,
          },
        })
      : [];
    const evMap = new Map(events.map((e) => [e.id, e]));

    for (const line of lines) {
      if (!line.toolUsageEventId) {
        skippedNoEvent += 1;
        continue;
      }
      const ev = evMap.get(line.toolUsageEventId);
      if (!ev) {
        skippedNoEvent += 1;
        continue;
      }

      const snap = await resolveBillableSnapshot(ev.toolKey, ev.action, {
        schemeARefModelKey: extractSchemeARefModelKey(ev.meta),
      });

      if (!snap || (snap.unitCostYuan == null && snap.retailMultiplier == null)) {
        skippedNoSnapshot += 1;
        if (!DRY) continue;
      }

      const refreshKind = snap?.billingKind ?? null;
      const refreshQty =
        snap?.billedImageCount ?? snap?.billedVideoSec ?? null;
      const refreshUnit =
        refreshKind === "VIDEO_MODEL_SPEC"
          ? "秒"
          : refreshKind === "OUTPUT_IMAGE" || refreshKind === "COST_PER_IMAGE"
            ? "张"
            : refreshKind === "TOKEN_IN_OUT"
              ? "千tokens"
              : null;

      const snapshot: ToolUsagePricingSnapshot = {
        unitCostYuan: snap?.unitCostYuan ?? null,
        retailMultiplier: snap?.retailMultiplier ?? null,
        ourUnitYuan: snap?.ourUnitYuan ?? null,
        schemeARefModelKey: snap?.schemeARefModelKey ?? null,
        billablePriceId: snap?.billablePriceId ?? null,
        // v007 Round 5 hotfix-4：refresh 也要同步透传 kind + 实际用量/单位，否则历史行刷不出"张"。
        cloudBillingKind: refreshKind,
        billedQty: refreshQty,
        billedUnit: refreshUnit,
      };

      const canonical = await resolveCanonicalForRefresh(ev.meta);

      const fresh = buildToolUsageBillingLineData({
        userId: ev.userId,
        toolKey: ev.toolKey,
        action: ev.action,
        costPoints: ev.costPoints ?? 0,
        meta: ev.meta,
        usageEventId: ev.id,
        createdAt: ev.createdAt,
        snap: snapshot,
        canonical,
        userHint: await userHintFor(ev.userId),
      });

      if (DRY) {
        console.log(
          `[dry] would update line=${line.id} → cost=${snapshot.unitCostYuan} M=${snapshot.retailMultiplier} ourUnit=${snapshot.ourUnitYuan} model=${snapshot.schemeARefModelKey}`,
        );
        continue;
      }

      await prisma.toolBillingDetailLine.update({
        where: { id: line.id },
        data: {
          cloudRow: fresh.cloudRow as Prisma.InputJsonValue,
          pricingTemplateKey: fresh.pricingTemplateKey,
        },
      });
      updated += 1;
    }

    cursor = lines[lines.length - 1]?.id ?? null;
    if (lines.length < BATCH) break;
  }

  console.log(
    JSON.stringify(
      {
        where: userIdFilter ?? "all-users",
        dry: DRY,
        scanned,
        updated,
        skippedNoSnapshot,
        skippedNoEvent,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
