/**
 * 删除指定日期以外的 GatewayRequestLog（费用明细数据源）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/clear-gateway-logs-except-date.ts --keep-date=2026-06-09 --confirm
 */
import { prisma } from "../lib/prisma";

async function main() {
  const confirm = process.argv.includes("--confirm");
  const keepArg = process.argv.find((a) => a.startsWith("--keep-date="));
  const keepDate = keepArg?.split("=")[1] ?? "2026-06-09";

  const start = new Date(`${keepDate}T00:00:00.000Z`);
  const end = new Date(`${keepDate}T23:59:59.999Z`);

  const keep = await prisma.gatewayRequestLog.findMany({
    where: { submittedAt: { gte: start, lte: end } },
    select: { id: true, model: true, requestKind: true, submittedAt: true, clientPage: true },
    orderBy: { submittedAt: "desc" },
  });

  const deleteCount = await prisma.gatewayRequestLog.count({
    where: {
      NOT: { submittedAt: { gte: start, lte: end } },
    },
  });

  console.log(`保留 ${keepDate} (UTC) 共 ${keep.length} 条：`);
  for (const r of keep) {
    console.log(`  ${r.submittedAt.toISOString()} ${r.requestKind} ${r.model} ${r.clientPage ?? ""}`);
  }
  console.log(`将删除其余 ${deleteCount} 条 GatewayRequestLog。`);

  if (!confirm) {
    console.log("请加 --confirm 执行删除。");
    return;
  }

  const r = await prisma.gatewayRequestLog.deleteMany({
    where: {
      NOT: { submittedAt: { gte: start, lte: end } },
    },
  });
  console.log(`已删除 ${r.count} 条。剩余 ${await prisma.gatewayRequestLog.count()} 条。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
