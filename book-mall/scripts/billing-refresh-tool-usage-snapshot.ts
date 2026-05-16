/**
 * v002 P0-5：把历史 `ToolBillingDetailLine`（source = TOOL_USAGE_GENERATED）的
 * `internalCloudCostUnitYuan / internalRetailMultiplier / internalOurUnitYuan /
 *   internalFormulaText` 用当前 `ToolBillablePrice` 命中行重新填一遍，
 * 并把 cloudRow 中对应中文 key 一起同步，保证 finance-web 表头/排序/筛选立即生效。
 *
 * 安全性：
 *   - 幂等：每次都 SET 为最新快照；不会重复写多行。
 *   - 不动 `internalChargedPoints` / `internalYuanReference` / `internalCapturedAt`（这些是「当时事实」）。
 *   - 默认按 user 范围（BILLING_REFRESH_USER_ID=<id>）/ 全量；--dry 试跑模式。
 *
 * 用法：
 *   pnpm tsx scripts/billing-refresh-tool-usage-snapshot.ts            # 全量
 *   BILLING_REFRESH_USER_ID=<id> pnpm tsx scripts/billing-refresh-tool-usage-snapshot.ts
 *   pnpm tsx scripts/billing-refresh-tool-usage-snapshot.ts --dry      # 试跑（不写库）
 */
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { resolveBillableSnapshot } from "../lib/tool-billable-price";
import {
  buildToolUsageBillingLineData,
  type ToolUsagePricingSnapshot,
} from "../lib/finance/tool-usage-billing-line";

const BATCH = 200;
const DRY = process.argv.includes("--dry");

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

type ScanLine = {
  id: string;
  userId: string;
  toolUsageEventId: string | null;
  internalChargedPoints: number | null;
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
        internalChargedPoints: true,
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

      const snapshot: ToolUsagePricingSnapshot = {
        unitCostYuan: snap?.unitCostYuan ?? null,
        retailMultiplier: snap?.retailMultiplier ?? null,
        ourUnitYuan: snap?.ourUnitYuan ?? null,
        schemeARefModelKey: snap?.schemeARefModelKey ?? null,
        billablePriceId: snap?.billablePriceId ?? null,
      };

      const fresh = buildToolUsageBillingLineData({
        userId: ev.userId,
        toolKey: ev.toolKey,
        action: ev.action,
        costPoints: ev.costPoints ?? line.internalChargedPoints ?? 0,
        meta: ev.meta,
        usageEventId: ev.id,
        createdAt: ev.createdAt,
        snap: snapshot,
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
          internalCloudCostUnitYuan: fresh.internalCloudCostUnitYuan,
          internalRetailMultiplier: fresh.internalRetailMultiplier,
          internalOurUnitYuan: fresh.internalOurUnitYuan,
          internalFormulaText: fresh.internalFormulaText,
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
