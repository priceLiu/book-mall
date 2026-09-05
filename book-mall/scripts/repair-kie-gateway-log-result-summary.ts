/**
 * 修复 KIE Gateway 日志：status=SUCCEEDED 但 resultSummary 缺 resultJson（看门狗误覆盖）。
 *
 *   pnpm exec dotenv -e .env.local -- tsx scripts/repair-kie-gateway-log-result-summary.ts
 *   pnpm exec dotenv -e .env.local -- tsx scripts/repair-kie-gateway-log-result-summary.ts --dry-run
 *   pnpm exec dotenv -e .env.local -- tsx scripts/repair-kie-gateway-log-result-summary.ts cmt602zh2002vy401w4oe9iw5
 *   pnpm exec dotenv -e .env.local -- tsx scripts/repair-kie-gateway-log-result-summary.ts --scan
 *   pnpm exec dotenv -e .env.local -- tsx scripts/repair-kie-gateway-log-result-summary.ts --since=2026-08-01
 */
import { repairKieGatewayLogResultSummaryIfMissing } from "../lib/gateway/kie-gateway-log-sync";
import { extractQrJobOutputUrl } from "../lib/quick-replica/qr-job-output";
import { prisma } from "../lib/prisma";

const DEFAULT_LOG_IDS = ["cmt602zh2002vy401w4oe9iw5"];

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const scan = argv.includes("--scan");
  const sinceArg = argv.find((a) => a.startsWith("--since="));
  const since = sinceArg ? new Date(sinceArg.slice("--since=".length)) : null;
  const logIds = argv.filter((a) => !a.startsWith("--"));
  return { dryRun, scan, since, logIds };
}

async function listCandidateLogIds(opts: {
  logIds: string[];
  scan: boolean;
  since: Date | null;
}): Promise<string[]> {
  if (opts.logIds.length > 0) return opts.logIds;
  if (!opts.scan && !opts.since) return DEFAULT_LOG_IDS;

  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      providerKind: "KIE",
      externalTaskId: { not: null },
      credentialId: { not: null },
      ...(opts.since ? { submittedAt: { gte: opts.since } } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: 500,
    select: {
      id: true,
      model: true,
      externalTaskId: true,
      submittedAt: true,
      resultSummary: true,
    },
  });

  return rows
    .filter((row) => !extractQrJobOutputUrl(row.resultSummary))
    .map((row) => row.id);
}

async function main() {
  const { dryRun, scan, since, logIds: argLogIds } = parseArgs(process.argv.slice(2));
  const logIds = await listCandidateLogIds({
    logIds: argLogIds,
    scan,
    since,
  });

  if (logIds.length === 0) {
    console.log("[repair-kie-result] 未发现需修复的 KIE 日志。");
    return;
  }

  console.log(
    `[repair-kie-result] 待处理 ${logIds.length} 条${dryRun ? "（dry-run）" : ""}`,
  );

  let repaired = 0;
  let skipped = 0;
  let failed = 0;

  for (const logId of logIds) {
    const before = await prisma.gatewayRequestLog.findUnique({
      where: { id: logId },
      select: {
        id: true,
        status: true,
        model: true,
        externalTaskId: true,
        submittedAt: true,
        resultSummary: true,
      },
    });
    if (!before) {
      console.log(`[repair-kie-result] ${logId} -> not_found`);
      failed += 1;
      continue;
    }

    const hadUrl = Boolean(extractQrJobOutputUrl(before.resultSummary));
    if (hadUrl) {
      console.log(`[repair-kie-result] ${logId} -> already_ok`);
      skipped += 1;
      continue;
    }

    console.log(
      `[repair-kie-result] ${logId} model=${before.model} vendorTask=${before.externalTaskId ?? "-"} submittedAt=${before.submittedAt?.toISOString() ?? "-"}`,
    );

    if (dryRun) {
      console.log(`[repair-kie-result]   dry-run skip vendor poll`);
      continue;
    }

    const ok = await repairKieGatewayLogResultSummaryIfMissing(logId);
    const after = await prisma.gatewayRequestLog.findUnique({
      where: { id: logId },
      select: { resultSummary: true },
    });
    const url = extractQrJobOutputUrl(after?.resultSummary)?.url;

    if (ok && url) {
      repaired += 1;
      console.log(`[repair-kie-result]   -> repaired url=${url}`);
    } else {
      failed += 1;
      console.log(`[repair-kie-result]   -> repair_failed`);
    }
  }

  console.log(
    `[repair-kie-result] done repaired=${repaired} skipped=${skipped} failed=${failed}`,
  );
}

main()
  .catch((e) => {
    console.error("[repair-kie-result] error", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
