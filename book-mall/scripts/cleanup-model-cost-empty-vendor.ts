/**
 * 停用 vendor 为空的 ModelCostProfile（历史脏数据）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/cleanup-model-cost-empty-vendor.ts
 *   pnpm exec dotenv -e .env.local -- tsx scripts/cleanup-model-cost-empty-vendor.ts --dry-run
 */
import { prisma } from "../lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const all = await prisma.modelCostProfile.findMany({
    where: { active: true, effectiveTo: null },
    orderBy: [{ canonicalModelKey: "asc" }, { createdAt: "asc" }],
  });

  const bad = all.filter((p) => !p.vendor.trim());
  if (bad.length === 0) {
    console.log("✓ 无 active 且 vendor 为空的成本档");
    return;
  }

  console.log(`发现 ${bad.length} 条 vendor 为空的 active 成本档：`);
  for (const p of bad) {
    console.log(
      `  - ${p.id} · ${p.canonicalModelKey} · ${p.unit} · tier=${p.tierRaw ?? "—"} · list=¥${Number(p.listCostYuan)} · note=${p.note ?? "—"}`,
    );
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] 未写入；去掉 --dry-run 将 active=false 并写 effectiveTo");
    return;
  }

  const now = new Date();
  for (const p of bad) {
    await prisma.modelCostProfile.update({
      where: { id: p.id },
      data: {
        active: false,
        effectiveTo: now,
        note: p.note
          ? `${p.note} · deactivated empty-vendor ${now.toISOString().slice(0, 10)}`
          : `deactivated empty-vendor ${now.toISOString().slice(0, 10)}`,
      },
    });
  }
  console.log(`\n✓ 已停用 ${bad.length} 条`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
