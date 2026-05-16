/**
 * 回填 ToolBillablePrice 的 v002 字段（cloudBillingKind / cloudTierRaw / cloudModelKey）。
 *
 * 推断顺序：DB 已有列 → 现行 PricingSourceLine 反查 → toolKey 启发式。
 *
 * 用法：
 *   cd book-mall && pnpm exec dotenv -e .env.local -- pnpm exec tsx scripts/billing-backfill-cloud-fields.ts --dry
 *   cd book-mall && pnpm exec dotenv -e .env.local -- pnpm exec tsx scripts/billing-backfill-cloud-fields.ts --apply
 */
import { prisma } from "../lib/prisma";
import {
  buildSourceLineLookup,
  classifyBillableRow,
  type SourceLineRef,
} from "../lib/finance/billable-row-classifier";

async function main() {
  const dryRun = !process.argv.includes("--apply");

  const currentVersion = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true, kind: true, label: true },
  });
  if (!currentVersion) {
    console.error("未找到当前生效的 PricingSourceVersion；请先运行 pnpm pricing:bootstrap 或 pnpm pricing:import-markdown");
    process.exit(1);
  }
  const sourceLines = await prisma.pricingSourceLine.findMany({
    where: { versionId: currentVersion.id },
    select: { modelKey: true, tierRaw: true, billingKind: true },
  });
  const lookup = buildSourceLineLookup(sourceLines as SourceLineRef[]);

  const rows = await prisma.toolBillablePrice.findMany({
    where: { active: true },
    select: {
      id: true,
      toolKey: true,
      action: true,
      schemeARefModelKey: true,
      cloudModelKey: true,
      cloudTierRaw: true,
      cloudBillingKind: true,
    },
  });

  let updated = 0;
  let skippedAlready = 0;
  let skippedUnknown = 0;
  for (const r of rows) {
    if (r.cloudBillingKind) {
      skippedAlready++;
      continue;
    }
    const cls = classifyBillableRow(r, lookup);
    if (!cls.billingKind) {
      skippedUnknown++;
      console.warn(
        `[skip:unknown] ${r.toolKey}/${r.schemeARefModelKey ?? "(*)"} → 无法推断 billingKind`,
      );
      continue;
    }
    const cloudModelKey = r.cloudModelKey ?? r.schemeARefModelKey ?? null;
    const update: Record<string, unknown> = {
      cloudBillingKind: cls.billingKind,
    };
    if (r.cloudTierRaw == null && cls.tierRaw != null) {
      update.cloudTierRaw = cls.tierRaw;
    }
    if (r.cloudModelKey == null && cloudModelKey) {
      update.cloudModelKey = cloudModelKey;
    }
    console.log(
      `${dryRun ? "[dry] " : "[apply] "}${r.toolKey}/${r.schemeARefModelKey ?? "(*)"} → BK=${cls.billingKind}` +
        ` tier=${cls.tierRaw ?? "—"} cloudModel=${cloudModelKey ?? "—"} (source=${cls.source})`,
    );
    if (!dryRun) {
      await prisma.toolBillablePrice.update({
        where: { id: r.id },
        data: update,
      });
    }
    updated++;
  }
  console.log(
    `\nDONE. dryRun=${dryRun} totalRows=${rows.length} updated=${updated} skippedAlready=${skippedAlready} skippedUnknown=${skippedUnknown}` +
      `\ncurrentVersion=${currentVersion.id} (${currentVersion.kind}${currentVersion.label ? ` · ${currentVersion.label}` : ""})`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
