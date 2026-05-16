/**
 * v002 数据补齐：把 `ToolBillablePrice.schemeAUnitCostYuan` 字段从 pricePoints / M / 100 反推填入。
 *
 * 背景：早期 admin 表单只维护了 `pricePoints` 与 `schemeAAdminRetailMultiplier`，
 * 没维护 `schemeAUnitCostYuan` 字段；`pricing:verify-billable-formula` 的成本漂移检测因此空跑。
 * 本脚本按 `cost = pricePoints / M / 100` 反推，并把结果写回库；之后运营可在后台「定价管理」
 * 按 `price.md` 实际官网价微调。
 *
 * 用法：
 *   pnpm tsx scripts/billing-backfill-schemea-unit-cost.ts --dry      # 预演
 *   pnpm tsx scripts/billing-backfill-schemea-unit-cost.ts            # 正式
 *
 * 安全：
 *   - 只处理 `schemeAUnitCostYuan IS NULL` 的行（已填的不动）。
 *   - 必须 `schemeAAdminRetailMultiplier > 0` 且 `pricePoints > 0`；否则跳过。
 *   - 幂等：再次运行已填的行会被 IS NULL 过滤掉。
 */
import { prisma } from "../lib/prisma";

const DRY = process.argv.includes("--dry");

async function main() {
  const rows = await prisma.toolBillablePrice.findMany({
    where: {
      schemeAUnitCostYuan: null,
      schemeAAdminRetailMultiplier: { not: null, gt: 0 },
      pricePoints: { gt: 0 },
    },
    select: {
      id: true,
      toolKey: true,
      action: true,
      schemeARefModelKey: true,
      pricePoints: true,
      schemeAAdminRetailMultiplier: true,
    },
    orderBy: [{ toolKey: "asc" }, { action: "asc" }, { schemeARefModelKey: "asc" }],
  });

  console.log(`[backfill] candidates=${rows.length} dry=${DRY}`);

  let updated = 0;
  for (const r of rows) {
    const mult = r.schemeAAdminRetailMultiplier;
    if (!mult || mult <= 0) continue;
    const cost = r.pricePoints / mult / 100;
    console.log(
      `${DRY ? "[dry]" : "[apply]"} ${r.toolKey} · ${r.action ?? "(*)"} · ` +
        `${r.schemeARefModelKey ?? "(no-ref)"} · points=${r.pricePoints} M=${mult} → cost=¥${cost.toFixed(6)}`,
    );
    if (DRY) continue;

    await prisma.toolBillablePrice.update({
      where: { id: r.id },
      data: { schemeAUnitCostYuan: cost },
    });
    updated += 1;
  }

  console.log(`\n[backfill] done. candidates=${rows.length} updated=${updated} dry=${DRY}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
