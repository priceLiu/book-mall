/**
 * 将已有团队的 maxConcurrency 同步为 min(席位数, 套餐档上限)。
 * 仅更新 TEAM 且仍为默认 2 的租户（避免覆盖主账号手动配置）。
 *
 * 用法：pnpm --dir book-mall exec tsx scripts/sync-team-max-concurrency.ts
 */
import { prisma } from "@/lib/prisma";
import { resolveDefaultTeamMaxConcurrency } from "@/lib/tenant/team-concurrency";

async function main() {
  const teams = await prisma.tenant.findMany({
    where: { type: "TEAM", maxConcurrency: 2 },
    select: { id: true, name: true, seatLimit: true, packageLevel: true, maxConcurrency: true },
  });

  let updated = 0;
  for (const t of teams) {
    const next = resolveDefaultTeamMaxConcurrency({
      seatLimit: t.seatLimit,
      packageLevel: t.packageLevel,
    });
    if (next === t.maxConcurrency) continue;
    await prisma.tenant.update({
      where: { id: t.id },
      data: { maxConcurrency: next },
    });
    console.log(`[sync] ${t.name} (${t.id}): maxConcurrency ${t.maxConcurrency} → ${next}`);
    updated++;
  }
  console.log(`Done. Updated ${updated} / ${teams.length} team(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
