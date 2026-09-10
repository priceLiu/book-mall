import { prisma } from "@/lib/prisma";
import {
  ECOM_MODEL_TRYON_MODULE,
  ECOM_MODEL_TRYON_TOOL_KEY,
} from "@/lib/ecom/ecom-model-tryon-types";
import { saveEcomModelTryonResultToAssets } from "@/lib/ecom/ecom-model-tryon-service";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { parseVtonTextTryonResult } from "@/lib/ecom/ecom-vton/meta";
import type { VtonTextTryonResult } from "@/lib/ecom/ecom-vton/types";

export type TextTryonTryonLibraryBackfillResult = {
  projectsScanned: number;
  resultsScanned: number;
  saved: number;
  skippedExisting: number;
  skippedOutOfRange: number;
  generationRecordsSaved: number;
};

/** Asia/Shanghai 日历日边界（UTC 存储比较用） */
export function shanghaiDayBounds(date = new Date()): { start: Date; end: Date } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const day = fmt.format(date);
  const start = new Date(`${day}T00:00:00+08:00`);
  const end = new Date(`${day}T23:59:59.999+08:00`);
  return { start, end };
}

function collectTextTryonResults(meta: unknown): VtonTextTryonResult[] {
  if (!meta || typeof meta !== "object") return [];
  const raw = (meta as { textTryonResults?: unknown }).textTryonResults;
  if (!Array.isArray(raw)) return [];
  const out: VtonTextTryonResult[] = [];
  for (const row of raw) {
    const parsed = parseVtonTextTryonResult(row);
    if (parsed) out.push(parsed);
  }
  return out;
}

export async function backfillTextTryonResultsToTryonLibrary(
  userId: string,
  opts?: {
    since?: Date;
    until?: Date;
    dryRun?: boolean;
  },
): Promise<TextTryonTryonLibraryBackfillResult> {
  const since = opts?.since;
  const until = opts?.until;

  const projects = await prisma.ecomVideoWorkflowProject.findMany({
    where: { userId, module: ECOM_MODEL_TRYON_MODULE },
    select: { id: true, meta: true },
  });

  let resultsScanned = 0;
  let saved = 0;
  let skippedExisting = 0;
  let skippedOutOfRange = 0;
  let generationRecordsSaved = 0;

  for (const project of projects) {
    for (const result of collectTextTryonResults(project.meta)) {
      resultsScanned += 1;
      const url = result.ossUrl?.trim();
      if (!url) continue;

      const createdAt = result.createdAt ? new Date(result.createdAt) : null;
      if (since && createdAt && createdAt < since) {
        skippedOutOfRange += 1;
        continue;
      }
      if (until && createdAt && createdAt > until) {
        skippedOutOfRange += 1;
        continue;
      }

      const title = `文生试衣 ${result.createdAt ? new Date(result.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : ""}`.trim();

      const existing = await prisma.ecomAsset.findFirst({
        where: { userId, module: ECOM_MODEL_TRYON_MODULE, ossUrl: url },
        select: { id: true },
      });
      if (existing) {
        skippedExisting += 1;
      } else if (opts?.dryRun) {
        saved += 1;
      } else {
        await saveEcomModelTryonResultToAssets(userId, project.id, {
          ossUrl: url,
          title,
        });
        saved += 1;
      }

      if (!opts?.dryRun) {
        const record = await persistEcomGenerationRecord({
          userId,
          ossUrl: url,
          title,
          prompt: result.prompt,
          meta: {
            sourceModule: ECOM_MODEL_TRYON_MODULE,
            sourceToolKey: `${ECOM_MODEL_TRYON_TOOL_KEY}__text-tryon`,
            projectId: project.id,
            sourceResultId: result.id,
            versionKey: `${project.id}:${result.id}`,
            modelKey: result.modelKey,
          },
        });
        if (record.created) generationRecordsSaved += 1;
      }
    }
  }

  return {
    projectsScanned: projects.length,
    resultsScanned,
    saved,
    skippedExisting,
    skippedOutOfRange,
    generationRecordsSaved,
  };
}
