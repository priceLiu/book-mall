import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getKindDef } from "@/lib/quick-replica/qr-kinds";
import { extractQrJobOutputUrl } from "@/lib/quick-replica/qr-job-output";
import {
  hasQrInputSummarySnap,
  previewImageUrlFromQrDraft,
  readQrDraftFromInputSummary,
} from "@/lib/quick-replica/qr-log-draft";
import { findQrTemplateByLogId } from "@/lib/quick-replica/qr-template-service";
import type { QrCategory } from "@/lib/quick-replica/qr-types";

export type QrGenerateJobRecord = {
  logId: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  submittedAt: string;
  completedAt?: string;
  title: string;
  kind: string;
  category: QrCategory;
  modelKey: string;
  previewImageUrl?: string;
  outputUrl?: string;
  /** image | video | audio · 供前端选择预览弹层 */
  outputMediaType?: "image" | "video" | "audio";
  /** 旁白等试听弹层展示用 */
  prompt?: string;
  voiceId?: string;
  error?: string;
  savedTemplateId?: string;
};

function mapLogStatus(status: string): QrGenerateJobRecord["status"] {
  if (status === "SUCCEEDED") return "SUCCEEDED";
  if (status === "FAILED") return "FAILED";
  if (status === "RUNNING") return "RUNNING";
  return "PENDING";
}

export async function listQrGenerateJobRecords(
  userId: string,
  limit = 40,
): Promise<QrGenerateJobRecord[]> {
  const capped = Math.min(80, Math.max(1, limit));
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      actorBookUserId: userId,
      clientSource: "QUICK_REPLICA",
      inputSummary: { not: Prisma.DbNull },
    },
    orderBy: { submittedAt: "desc" },
    take: capped * 3,
    select: {
      id: true,
      status: true,
      submittedAt: true,
      completedAt: true,
      failMessage: true,
      inputSummary: true,
      resultSummary: true,
      model: true,
    },
  });

  const records: QrGenerateJobRecord[] = [];
  for (const row of rows) {
    if (!hasQrInputSummarySnap(row.inputSummary)) continue;

    const draft = readQrDraftFromInputSummary(row.inputSummary, row.model);
    const kind = draft?.kind ?? "motion-sync";
    const category = draft?.category ?? "video";
    const title =
      draft?.title?.trim() ||
      `${getKindDef(kind)?.label ?? kind} · ${row.submittedAt.toLocaleString("zh-CN")}`;

    const outputFromLog = extractQrJobOutputUrl(row.resultSummary);
    const saved = await findQrTemplateByLogId(row.id);
    const outputUrl = outputFromLog?.url ?? saved?.output?.url;
    const outputMediaType =
      outputFromLog?.mediaType ??
      saved?.output?.mediaType ??
      (category === "audio" ? "audio" : category === "image" || category === "character" ? "image" : "video");

    records.push({
      logId: row.id,
      status: mapLogStatus(row.status),
      submittedAt: row.submittedAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      title,
      kind,
      category,
      modelKey: draft?.modelKey ?? row.model,
      previewImageUrl: previewImageUrlFromQrDraft(draft),
      outputUrl,
      outputMediaType,
      prompt: draft?.prompt?.trim() || undefined,
      voiceId: draft?.voiceId?.trim() || undefined,
      error: row.status === "FAILED" ? row.failMessage ?? "生成失败" : undefined,
      savedTemplateId: saved?.id,
    });
    if (records.length >= capped) break;
  }
  return records;
}
