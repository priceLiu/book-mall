import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getKindDef } from "@/lib/quick-replica/qr-kinds";
import { extractQrJobOutputUrl } from "@/lib/quick-replica/qr-job-output";
import { findQrTemplateByLogId } from "@/lib/quick-replica/qr-template-service";
import type { QrCategory, QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

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
  error?: string;
  savedTemplateId?: string;
};

function readDraftFromInputSummary(inputSummary: unknown): QrWorkspaceDraft | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const root = inputSummary as Record<string, unknown>;
  const snap = root.qrGenerate ?? root.qrMotionSync;
  if (!snap || typeof snap !== "object") return null;
  const s = snap as Record<string, unknown>;
  if (s.draft && typeof s.draft === "object") {
    return s.draft as QrWorkspaceDraft;
  }
  if (typeof s.targetImageUrl === "string") {
    return {
      category: "video",
      kind: "motion-sync",
      toolKey: "motion-sync",
      targetImageUrl: String(s.targetImageUrl ?? ""),
      referenceVideoUrl: String(s.referenceVideoUrl ?? ""),
      referenceAudioUrl: "",
      sceneImageUrls: [],
      prompt: String(s.prompt ?? ""),
      modelKey: String(s.modelKey ?? ""),
      mode: typeof s.mode === "string" ? s.mode : undefined,
      characterOrientation:
        typeof s.characterOrientation === "string" ? s.characterOrientation : undefined,
    };
  }
  return null;
}

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
    take: capped,
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
    const draft = readDraftFromInputSummary(row.inputSummary);
    const hasQrSnap =
      row.inputSummary &&
      typeof row.inputSummary === "object" &&
      ((row.inputSummary as Record<string, unknown>).qrGenerate ||
        (row.inputSummary as Record<string, unknown>).qrMotionSync);
    if (!hasQrSnap) continue;

    const kind = draft?.kind ?? "motion-sync";
    const category = draft?.category ?? "video";
    const title =
      draft?.title?.trim() ||
      `${getKindDef(kind)?.label ?? kind} · ${row.submittedAt.toLocaleString("zh-CN")}`;

    const outputFromLog = extractQrJobOutputUrl(row.resultSummary);
    const saved = await findQrTemplateByLogId(row.id);

    records.push({
      logId: row.id,
      status: mapLogStatus(row.status),
      submittedAt: row.submittedAt.toISOString(),
      completedAt: row.completedAt?.toISOString(),
      title,
      kind,
      category,
      modelKey: draft?.modelKey ?? row.model,
      previewImageUrl: draft?.targetImageUrl?.trim() || undefined,
      outputUrl: outputFromLog?.url ?? saved?.output?.url,
      error: row.status === "FAILED" ? row.failMessage ?? "生成失败" : undefined,
      savedTemplateId: saved?.id,
    });
  }
  return records;
}
