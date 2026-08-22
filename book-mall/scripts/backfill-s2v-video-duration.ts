/**
 * 回填 wan2.2-s2v Gateway 日志 usage.duration（AR-105）。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-s2v-video-duration.ts --dry
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-s2v-video-duration.ts --apply
 */
import {
  inferS2vVideoSecondsFromLog,
  mergeS2vDurationIntoResultSummary,
} from "@/lib/finance/infer-s2v-video-seconds";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

async function main() {
  const sinceStr = arg("since");
  const since = sinceStr ? new Date(`${sinceStr}T00:00:00+08:00`) : undefined;
  const limit = Number(arg("limit") ?? "300");

  console.log(`MODE: ${APPLY ? "APPLY" : "DRY"} · since=${sinceStr ?? "all"} · limit=${limit}`);

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      ...(since ? { submittedAt: { gte: since } } : {}),
      OR: [
        { model: "wan2.2-s2v" },
        { canonicalModelKey: "wan2.2-s2v" },
      ],
    },
    select: {
      id: true,
      model: true,
      canonicalModelKey: true,
      requestKind: true,
      inputSummary: true,
      resultSummary: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });

  const composeTasks = await prisma.aiSpaceComposeTask.findMany({
    where: { gatewayLogId: { in: logs.map((l) => l.id) } },
    select: { id: true, gatewayLogId: true, audioAssetId: true },
  });
  const audioIds = [...new Set(composeTasks.map((t) => t.audioAssetId))];
  const audios =
    audioIds.length > 0
      ? await prisma.aiSpaceAudioAsset.findMany({
          where: { id: { in: audioIds } },
          select: { id: true, durationSec: true },
        })
      : [];
  const audioById = new Map(audios.map((a) => [a.id, a.durationSec]));
  const audioByLogId = new Map<string, number>();
  for (const t of composeTasks) {
    if (t.gatewayLogId) {
      const sec = audioById.get(t.audioAssetId);
      if (sec != null) audioByLogId.set(t.gatewayLogId, sec);
    }
  }

  let updated = 0;
  let skipped = 0;

  for (const log of logs) {
    const inferred = inferS2vVideoSecondsFromLog({
      ...log,
      audioDurationSecFallback: audioByLogId.get(log.id) ?? null,
    });
    if (inferred == null) {
      skipped += 1;
      continue;
    }

    const merged = mergeS2vDurationIntoResultSummary(log.resultSummary, inferred);
    const result = log.resultSummary as Record<string, unknown> | null;
    const usage = result?.usage as Record<string, unknown> | undefined;
    if (usage?.duration != null && Number(usage.duration) === inferred) {
      skipped += 1;
      continue;
    }

    console.log(
      `[${APPLY ? "apply" : "dry"}] ${log.id} ${log.submittedAt?.toISOString().slice(0, 10)} → ${inferred}s`,
    );
    if (APPLY) {
      await prisma.gatewayRequestLog.update({
        where: { id: log.id },
        data: { resultSummary: merged },
      });
    }
    updated += 1;
  }

  console.log(`完成：候选 ${logs.length}，${APPLY ? "更新" : "可更新"} ${updated}，跳过 ${skipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
