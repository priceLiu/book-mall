/**
 * 一次性迁移：ToolBillablePrice.schemeARefModelKey → ModelAlias (INTERNAL_SCHEME_A_MODEL)。
 *
 *   cd book-mall && pnpm exec dotenv -e .env.local -- tsx scripts/migrate-tbp-to-alias.ts [--confirm]
 *
 * 默认 dry-run；加 --confirm 才写入。复用 auto-calibrate 的 catalog 派生逻辑。
 */
import { prisma } from "../lib/prisma";
import { runFullAutoCalibration } from "../lib/model-catalog/auto-calibrate";

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const confirm = hasFlag("confirm");
  console.log(`[migrate-tbp-to-alias] ${confirm ? "执行" : "DRY-RUN"}`);

  const rows = await prisma.toolBillablePrice.findMany({
    where: { schemeARefModelKey: { not: null } },
    select: { schemeARefModelKey: true, toolKey: true, cloudBillingKind: true },
    distinct: ["schemeARefModelKey"],
  });
  const keys = rows.map((r) => r.schemeARefModelKey).filter((k): k is string => !!k?.trim());
  console.log(`  发现 ${keys.length} 个唯一 schemeARefModelKey`);

  const existingAliases = await prisma.modelAlias.count({
    where: {
      source: "INTERNAL_SCHEME_A_MODEL",
      aliasValue: { in: keys },
      catalogId: { not: null },
    },
  });
  console.log(`  已绑定 catalog 的别名：${existingAliases}`);

  if (!confirm) {
    console.log("  预览完成。加 --confirm 执行 runFullAutoCalibration（含 TBP→catalog→alias）。");
    return;
  }

  const result = await runFullAutoCalibration();
  console.log("[migrate-tbp-to-alias] 完成:", result);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
