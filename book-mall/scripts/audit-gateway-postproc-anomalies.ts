#!/usr/bin/env tsx
/**
 * 审计：火山视频「后处理」异常虚高的成功任务（看门狗是否漏收口的证据）。
 *
 * 用法：
 *   dotenv -e .env.local -- tsx scripts/audit-gateway-postproc-anomalies.ts \
 *     --from 2026-06-27T01:00:00.000Z --to 2026-06-27T03:00:00.000Z --min-post-sec 500
 *
 *   # 或用本地日期+时分（按 UTC+8 解释），默认窗口当天 09:00-11:00：
 *   dotenv -e .env.local -- tsx scripts/audit-gateway-postproc-anomalies.ts \
 *     --date 2026-06-27 --from-hm 09:00 --to-hm 11:00 --min-post-sec 500
 */
import { prisma } from "../lib/prisma";
import {
  computeVolcengineTimingBreakdown,
  readVolcengineTimingTrace,
} from "../lib/gateway/log-volcengine-timing";

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

function sec(ms: number | null | undefined): number | null {
  return ms == null ? null : Math.round(ms / 1000);
}

/** 把 "YYYY-MM-DD" + "HH:mm"（UTC+8）转成 UTC Date */
function fromLocalHm(date: string, hm: string): Date {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return new Date(`${date}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00.000+08:00`);
}

function resolveWindow(): { from: Date; to: Date } {
  const fromIso = arg("from");
  const toIso = arg("to");
  if (fromIso && toIso) {
    return { from: new Date(fromIso), to: new Date(toIso) };
  }
  const date = arg("date") ?? new Date().toISOString().slice(0, 10);
  const fromHm = arg("from-hm") ?? "09:00";
  const toHm = arg("to-hm") ?? "11:00";
  return { from: fromLocalHm(date, fromHm), to: fromLocalHm(date, toHm) };
}

async function main() {
  const { from, to } = resolveWindow();
  const minPostSec = Number(arg("min-post-sec") ?? "500");
  const minPostMs = minPostSec * 1000;

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      submittedAt: { gte: from, lt: to },
    },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      model: true,
      status: true,
      submittedAt: true,
      completedAt: true,
      durationMs: true,
      lastPolledAt: true,
      externalTaskId: true,
      resultSummary: true,
    },
  });

  const anomalies: Record<string, unknown>[] = [];
  let scanned = 0;
  let withTrace = 0;

  for (const log of logs) {
    scanned++;
    const trace = readVolcengineTimingTrace(log.resultSummary);
    if (!trace) continue;
    withTrace++;
    const completedMs = log.completedAt?.getTime() ?? null;
    const b = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs: log.submittedAt.getTime(),
      completedAtMs: completedMs,
    });
    const post = b.vendorPostProcessMs ?? 0;
    if (post < minPostMs) continue;

    // GPU 真值跨度（created→updated）
    const gpuMs =
      trace.vendorCreatedAtMs != null && trace.vendorUpdatedAtMs != null
        ? Math.max(0, trace.vendorUpdatedAtMs - trace.vendorCreatedAtMs)
        : null;

    anomalies.push({
      id: log.id,
      model: log.model,
      status: log.status,
      externalTaskId: log.externalTaskId,
      submittedAt: log.submittedAt.toISOString(),
      completedAt: log.completedAt?.toISOString() ?? null,
      totalSec: sec(log.durationMs),
      queueSec: sec(b.queueMs),
      generateSec: sec(b.generateMs),
      postProcSec: sec(post),
      pollDelaySec: sec(b.pollDelayMs),
      gpuNativeSec: sec(gpuMs),
      lastStatus: trace.lastStatus,
      lastPolledAt: log.lastPolledAt?.toISOString() ?? null,
      vendorCreatedAt: trace.vendorCreatedAtMs
        ? new Date(trace.vendorCreatedAtMs).toISOString()
        : null,
      vendorUpdatedAt: trace.vendorUpdatedAtMs
        ? new Date(trace.vendorUpdatedAtMs).toISOString()
        : null,
    });
  }

  anomalies.sort(
    (a, b) => Number(b.postProcSec ?? 0) - Number(a.postProcSec ?? 0),
  );

  console.log(
    JSON.stringify(
      {
        window: { fromUtc: from.toISOString(), toUtc: to.toISOString() },
        minPostSec,
        scanned,
        withTrace,
        anomalyCount: anomalies.length,
        anomalies,
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
