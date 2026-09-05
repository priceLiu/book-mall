/**
 * 从对账总表已知厂商挂牌价批量同步 ModelCostProfile 并重发积分。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/sync-vendor-list-prices-from-master.ts
 *   pnpm exec dotenv -e .env.local -- tsx scripts/sync-vendor-list-prices-from-master.ts --period-key 20260724_20260822
 */
import { syncVendorListPricesFromBillLines } from "../lib/pricing/sync-vendor-list-cost-profile";
import type { VendorBillLine } from "../lib/finance/reconciliation-v2/types";
import { prisma } from "../lib/prisma";

function num(v: unknown, fallback = 0): number {
  if (v == null) return fallback;
  const n = typeof v === "number" ? v : Number(v.toString());
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  const periodKeyArg = process.argv.find((a) => a.startsWith("--period-key="))?.split("=")[1];

  const masterLines = await prisma.billingReconciliationMasterLine.findMany({
    where: {
      ...(periodKeyArg ? { periodKey: periodKeyArg } : {}),
      listUnitYuan: { not: null },
    },
    select: {
      importVendor: true,
      joinKey: true,
      periodMonth: true,
      periodFrom: true,
      periodTo: true,
      periodKey: true,
      modelKey: true,
      tierRaw: true,
      unitKind: true,
      tokenDirection: true,
      listUnitYuan: true,
    },
  });

  const vendorLines: VendorBillLine[] = [];
  const seen = new Set<string>();

  for (const row of masterLines) {
    const listUnitYuan = num(row.listUnitYuan);
    if (!(listUnitYuan > 0)) continue;
    const dedupeKey = `${row.joinKey}|${listUnitYuan}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    vendorLines.push({
      vendor: row.importVendor ?? row.joinKey.split("|")[0] ?? "aliyun",
      joinKey: row.joinKey ?? dedupeKey,
      month: row.periodMonth ?? "",
      period: {
        from: row.periodFrom?.toISOString().slice(0, 10) ?? "1970-01-01",
        to: row.periodTo?.toISOString().slice(0, 10) ?? "1970-01-01",
      },
      periodKey: row.periodKey ?? "",
      cloudAccountId: null,
      modelKey: row.modelKey,
      tierRaw: row.tierRaw,
      unitKind: (row.unitKind ?? "CALL") as VendorBillLine["unitKind"],
      tokenDirection: (row.tokenDirection ?? "none") as VendorBillLine["tokenDirection"],
      vendorUnits: 0,
      listUnitYuan,
      vendorListYuan: 0,
      csvRowCount: 0,
    });
  }

  console.log(
    `[sync] master lines with listUnitYuan: ${masterLines.length} → deduped vendor lines: ${vendorLines.length}`,
  );

  const result = await syncVendorListPricesFromBillLines(vendorLines, {
    publishedBy: "sync-vendor-list-prices-from-master",
  });

  console.log(
    `[done] profiles upserted=${result.profilesUpserted} skipped=${result.profilesSkipped} credits published=${result.creditsPublished} skipped=${result.creditsSkipped}`,
  );
  if (result.errors.length) {
    console.warn("[errors]", result.errors.slice(0, 20).join("\n"));
    if (result.errors.length > 20) {
      console.warn(`… and ${result.errors.length - 20} more`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
