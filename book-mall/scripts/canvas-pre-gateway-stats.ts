#!/usr/bin/env tsx
/**
 * 画布 Pre-Gateway 分布：点击 → Gateway submitted（出队/createTask 前）
 *
 * 用法：pnpm --dir book-mall canvas:pre-gateway-stats [--hours=12]
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const hoursArg = process.argv.find((a) => a.startsWith("--hours="));
  const hours = hoursArg ? Number(hoursArg.split("=")[1]) : 12;
  const since = new Date(Date.now() - hours * 3600 * 1000);

  const stats = (await prisma.$queryRaw`
    SELECT 
      COUNT(*)::int AS n,
      COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt"))),0)::int AS pre_p50_sec,
      COALESCE(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt"))),0)::int AS pre_p90_sec,
      COALESCE(MAX(EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt"))),0)::int AS pre_max_sec,
      COALESCE(AVG(EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt"))),0)::int AS pre_avg_sec,
      COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt")) > 120)::int AS over_2min,
      COUNT(*) FILTER (WHERE EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt")) > 300)::int AS over_5min
    FROM "CanvasGenerationTask" t
    INNER JOIN "GatewayRequestLog" g ON g.id = (t."inputPayload"->>'gatewayLogId')
    WHERE g."submittedAt" >= ${since}
  `) as Array<Record<string, number>>;

  const top = await prisma.$queryRaw`
    SELECT t.id AS task_id,
      EXTRACT(EPOCH FROM (g."submittedAt" - t."createdAt"))::int AS pre_sec,
      g.status AS gw_status,
      g."submittedAt",
      t."createdAt"
    FROM "CanvasGenerationTask" t
    INNER JOIN "GatewayRequestLog" g ON g.id = (t."inputPayload"->>'gatewayLogId')
    WHERE g."submittedAt" >= ${since}
    ORDER BY pre_sec DESC
    LIMIT 10
  `;

  console.log(
    JSON.stringify(
      { since: since.toISOString(), hours, stats: stats[0], topPreGateway: top },
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
