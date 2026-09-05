/**
 * 回填 Gateway ASR 日志 resultSummary.audioDurationSec（AR-104）。
 *
 * 用法：
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-asr-audio-duration.ts --dry
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-asr-audio-duration.ts --apply
 *   pnpm exec dotenv -e .env.local -- tsx scripts/backfill-asr-audio-duration.ts --apply --since=2026-08-01 --probe-urls
 */
import {
  inferAsrAudioDurationSecFromLog,
  mergeAsrAudioDurationIntoResultSummary,
} from "@/lib/finance/infer-asr-audio-duration";
import { ffprobeAudioDurationSec } from "@/lib/media/render-ffmpeg";
import { prisma } from "@/lib/prisma";

const APPLY = process.argv.includes("--apply");
const PROBE_URLS = process.argv.includes("--probe-urls");

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

function readAsrFileUrl(inputSummary: unknown): string | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  const input = root.input;
  if (!input || typeof input !== "object") return null;
  const row = input as Record<string, unknown>;
  const url = String(row.fileUrl ?? row.audioUrl ?? "").trim();
  return /^https?:\/\//.test(url) ? url : null;
}

async function probeFileDurationSec(fileUrl: string): Promise<number | null> {
  try {
    const sec = await ffprobeAudioDurationSec(fileUrl);
    return Math.max(1, Math.round(sec));
  } catch {
    return null;
  }
}

async function main() {
  const sinceStr = arg("since");
  const since = sinceStr ? new Date(`${sinceStr}T00:00:00+08:00`) : undefined;
  const limit = Number(arg("limit") ?? "500");

  console.log(
    `MODE: ${APPLY ? "APPLY" : "DRY"} · since=${sinceStr ?? "all"} · limit=${limit} · probe-urls=${PROBE_URLS}`,
  );

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "SUCCEEDED",
      ...(since ? { submittedAt: { gte: since } } : {}),
      OR: [
        { model: { contains: "asr", mode: "insensitive" } },
        { canonicalModelKey: { contains: "asr", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      model: true,
      canonicalModelKey: true,
      inputSummary: true,
      resultSummary: true,
      submittedAt: true,
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });

  let updated = 0;
  let skipped = 0;

  for (const log of logs) {
    let inferred = inferAsrAudioDurationSecFromLog(log);
    if (PROBE_URLS) {
      const fileUrl = readAsrFileUrl(log.inputSummary);
      if (fileUrl) {
        const probed = await probeFileDurationSec(fileUrl);
        if (probed != null && (inferred == null || probed > inferred)) {
          inferred = probed;
        }
      }
    }
    if (inferred == null) {
      skipped += 1;
      continue;
    }
    const result = log.resultSummary as Record<string, unknown> | null;
    const existing = result?.sourceAudioDurationSec ?? result?.audioDurationSec;
    if (existing != null && Number(existing) === inferred) {
      skipped += 1;
      continue;
    }

    const merged = mergeAsrAudioDurationIntoResultSummary(log.resultSummary, inferred);
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
