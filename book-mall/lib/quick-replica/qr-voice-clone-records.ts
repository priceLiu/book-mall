/**
 * 快速复制 · 声音克隆记录（与「我的作品 · 音频 · 语音克隆」一一对应）
 */

import { extractQrJobOutputUrl } from "@/lib/quick-replica/qr-job-output";
import { rowToJson } from "@/lib/quick-replica/qr-template-service";
import type { QrTemplateJson } from "@/lib/quick-replica/qr-types";
import { prisma } from "@/lib/prisma";

export type QrVoiceCloneCatalogEntry = {
  catalogId: string;
  voiceId: string;
  label: string;
  previewUrl?: string;
  clonedAt: string;
};

export type QrVoiceCloneUploadRow = {
  id: string;
  name: string;
  mediaUrl: string;
  clonedAt: string;
  voiceId?: string;
};

function trimLabel(text: string, max = 40): string {
  const t = text.trim();
  if (!t) return t;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function readCloneVoiceIdFromTemplate(template: QrTemplateJson): string {
  const params = template.reference?.model?.params;
  if (!params || typeof params !== "object") return "";
  const p = params as Record<string, unknown>;
  return (
    (typeof p.clone_voice_id === "string" ? p.clone_voice_id.trim() : "") ||
    (typeof p.voice_id === "string" ? p.voice_id.trim() : "") ||
    ""
  );
}

function readVoiceCloneDraftFromLog(inputSummary: unknown): {
  cloneVoiceId?: string;
  prompt?: string;
  title?: string;
} | null {
  if (!inputSummary || typeof inputSummary !== "object") return null;
  const snap = (inputSummary as Record<string, unknown>).qrVoiceClone;
  if (!snap || typeof snap !== "object") return null;
  const draft = (snap as Record<string, unknown>).draft;
  if (!draft || typeof draft !== "object") return null;
  const d = draft as Record<string, unknown>;
  return {
    cloneVoiceId:
      typeof d.cloneVoiceId === "string" ? d.cloneVoiceId.trim() : undefined,
    prompt: typeof d.prompt === "string" ? d.prompt.trim() : undefined,
    title: typeof d.title === "string" ? d.title.trim() : undefined,
  };
}

function resolveVoiceIdFromLog(inputSummary: unknown, resultSummary: unknown): string {
  const draft = readVoiceCloneDraftFromLog(inputSummary);
  const input = inputSummary as {
    qrVoiceClone?: { draft?: { cloneVoiceId?: string } };
  } | null;
  const result = resultSummary as { voice_id?: string } | null;
  return (
    result?.voice_id?.trim() ||
    draft?.cloneVoiceId ||
    input?.qrVoiceClone?.draft?.cloneVoiceId?.trim() ||
    ""
  );
}

function isAudioMediaUrl(url: string): boolean {
  return /\.(mp3|wav|m4a|aac|ogg|flac)(\?|$)/i.test(url.trim());
}

function isVoiceCloneTemplate(row: { kind: string }, template: QrTemplateJson): boolean {
  if (row.kind === "voice-clone" || row.kind === "voice_clone") return true;
  return readCloneVoiceIdFromTemplate(template) !== "";
}

async function loadVoiceCloneLogIdSet(logIds: string[]): Promise<Set<string>> {
  if (logIds.length === 0) return new Set();
  const rows = await prisma.gatewayRequestLog.findMany({
    where: { id: { in: logIds } },
    select: { id: true, inputSummary: true },
  });
  const set = new Set<string>();
  for (const row of rows) {
    if (readVoiceCloneDraftFromLog(row.inputSummary)) set.add(row.id);
  }
  return set;
}

async function loadVoiceCloneTemplates(userId: string) {
  const rows = await prisma.qrTemplate.findMany({
    where: { ownerUserId: userId, deletedAt: null, category: "audio" },
    orderBy: { createdAt: "desc" },
    take: 120,
  });
  const linkedLogIds = rows
    .map((row) => row.gatewayRequestLogId?.trim())
    .filter((id): id is string => Boolean(id));
  const voiceCloneLogIds = await loadVoiceCloneLogIdSet(linkedLogIds);

  return rows.filter((row) => {
    const template = rowToJson(row);
    if (isVoiceCloneTemplate(row, template)) return true;
    const logId = row.gatewayRequestLogId?.trim();
    return Boolean(logId && voiceCloneLogIds.has(logId));
  });
}

async function loadVoiceCloneSucceededLogs(userId: string) {
  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      actorBookUserId: userId,
      clientSource: "QUICK_REPLICA",
      status: "SUCCEEDED",
    },
    orderBy: { submittedAt: "desc" },
    take: 160,
    select: {
      id: true,
      submittedAt: true,
      inputSummary: true,
      resultSummary: true,
    },
  });
  return rows.filter((row) => readVoiceCloneDraftFromLog(row.inputSummary) != null);
}

async function loadVoiceIdByLogIds(logIds: string[]): Promise<Map<string, string>> {
  if (logIds.length === 0) return new Map();
  const rows = await prisma.gatewayRequestLog.findMany({
    where: { id: { in: logIds } },
    select: { id: true, inputSummary: true, resultSummary: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const voiceId = resolveVoiceIdFromLog(row.inputSummary, row.resultSummary);
    if (voiceId) map.set(row.id, voiceId);
  }
  return map;
}

async function loadPreviewByLogIds(logIds: string[]): Promise<Map<string, string>> {
  if (logIds.length === 0) return new Map();
  const rows = await prisma.gatewayRequestLog.findMany({
    where: { id: { in: logIds } },
    select: { id: true, resultSummary: true },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const output = extractQrJobOutputUrl(row.resultSummary);
    if (output?.url && (output.mediaType === "audio" || isAudioMediaUrl(output.url))) {
      map.set(row.id, output.url);
    }
  }
  return map;
}

async function loadPreviewFromAiSpaceByLogIds(
  logIds: string[],
): Promise<Map<string, string>> {
  if (logIds.length === 0) return new Map();
  const rows = await prisma.aiSpaceAudioAsset.findMany({
    where: {
      originRef: { in: logIds },
      sourceType: "voice_clone",
    },
    select: { originRef: true, audioUrl: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const map = new Map<string, string>();
  for (const row of rows) {
    const logId = row.originRef?.trim();
    const url = row.audioUrl?.trim();
    if (!logId || !url || map.has(logId)) continue;
    map.set(logId, url);
  }
  return map;
}

function pickPreviewUrl(
  candidates: Array<string | undefined | null>,
): string | undefined {
  for (const raw of candidates) {
    const url = raw?.trim();
    if (url && (isAudioMediaUrl(url) || url.includes("/audio/") || url.includes(".mp3"))) {
      return url;
    }
  }
  return undefined;
}

function resolveTemplatePreviewUrl(
  template: QrTemplateJson,
  previewByLogId: Map<string, string>,
  aiSpacePreviewByLogId: Map<string, string>,
  gatewayRequestLogId?: string | null,
  thumbnailUrl?: string | null,
): string | undefined {
  const outputUrl = template.output?.url?.trim() ?? "";
  const fromOutput = pickPreviewUrl([
    outputUrl &&
    (template.output?.mediaType === "audio" || isAudioMediaUrl(outputUrl))
      ? outputUrl
      : isAudioMediaUrl(outputUrl)
        ? outputUrl
        : undefined,
    gatewayRequestLogId ? previewByLogId.get(gatewayRequestLogId) : undefined,
    gatewayRequestLogId ? aiSpacePreviewByLogId.get(gatewayRequestLogId) : undefined,
    thumbnailUrl && isAudioMediaUrl(thumbnailUrl) ? thumbnailUrl : undefined,
  ]);
  return fromOutput;
}

function resolveLogPreviewUrl(
  resultSummary: unknown,
  logId: string,
  previewByLogId: Map<string, string>,
  aiSpacePreviewByLogId: Map<string, string>,
): string | undefined {
  return pickPreviewUrl([
    previewByLogId.get(logId),
    aiSpacePreviewByLogId.get(logId),
    extractQrJobOutputUrl(resultSummary)?.url,
  ]);
}

/** 每条「我的作品 · 语音克隆」或等价 Gateway 成功记录一项 */
export async function listQrVoiceCloneCatalogEntries(
  userId: string,
): Promise<QrVoiceCloneCatalogEntry[]> {
  const entries: QrVoiceCloneCatalogEntry[] = [];
  const templateLogIds = new Set<string>();

  const [templates, voiceCloneLogs] = await Promise.all([
    loadVoiceCloneTemplates(userId),
    loadVoiceCloneSucceededLogs(userId),
  ]);

  const logIds = [
    ...new Set([
      ...templates
        .map((row) => row.gatewayRequestLogId?.trim())
        .filter((id): id is string => Boolean(id)),
      ...voiceCloneLogs.map((row) => row.id),
    ]),
  ];

  const [voiceIdByLogId, previewByLogId, aiSpacePreviewByLogId] = await Promise.all([
    loadVoiceIdByLogIds(logIds),
    loadPreviewByLogIds(logIds),
    loadPreviewFromAiSpaceByLogIds(logIds),
  ]);

  for (const row of templates) {
    const template = rowToJson(row);
    const previewUrl = resolveTemplatePreviewUrl(
      template,
      previewByLogId,
      aiSpacePreviewByLogId,
      row.gatewayRequestLogId,
      row.thumbnailUrl,
    );
    const prompt = template.reference?.prompt?.text?.trim();
    const label = trimLabel(prompt || template.title || "声音克隆", 24);
    const clonedAt = template.output?.createdAt || template.createdAt;

    let voiceId = readCloneVoiceIdFromTemplate(template);
    if (!voiceId && row.gatewayRequestLogId) {
      voiceId = voiceIdByLogId.get(row.gatewayRequestLogId) ?? "";
    }
    if (!voiceId) voiceId = `unknown-${template.id}`;

    entries.push({
      catalogId: `tpl-${template.id}`,
      voiceId,
      label,
      previewUrl,
      clonedAt,
    });

    if (row.gatewayRequestLogId) templateLogIds.add(row.gatewayRequestLogId);
  }

  for (const row of voiceCloneLogs) {
    if (templateLogIds.has(row.id)) continue;
    const draft = readVoiceCloneDraftFromLog(row.inputSummary);
    const voiceId = resolveVoiceIdFromLog(row.inputSummary, row.resultSummary);
    if (!voiceId) continue;

    entries.push({
      catalogId: `job-${row.id}`,
      voiceId,
      label: trimLabel(
        draft?.prompt || draft?.title || voiceId,
        24,
      ),
      previewUrl: resolveLogPreviewUrl(
        row.resultSummary,
        row.id,
        previewByLogId,
        aiSpacePreviewByLogId,
      ),
      clonedAt: row.submittedAt.toISOString(),
    });
  }

  return entries.sort((a, b) => b.clonedAt.localeCompare(a.clonedAt));
}

export async function listQrVoiceCloneRecords(
  userId: string,
): Promise<
  Array<{ voiceId: string; label: string; previewUrl?: string; clonedAt: string }>
> {
  const entries = await listQrVoiceCloneCatalogEntries(userId);
  return entries.map(({ voiceId, label, previewUrl, clonedAt }) => ({
    voiceId,
    label,
    previewUrl,
    clonedAt,
  }));
}

export async function listQrVoiceCloneUploadRows(
  userId: string,
): Promise<QrVoiceCloneUploadRow[]> {
  const rows: QrVoiceCloneUploadRow[] = [];
  const seenCatalog = new Set<string>();

  const [templates, voiceCloneLogs] = await Promise.all([
    loadVoiceCloneTemplates(userId),
    loadVoiceCloneSucceededLogs(userId),
  ]);

  const logIds = [
    ...new Set([
      ...templates
        .map((row) => row.gatewayRequestLogId?.trim())
        .filter((id): id is string => Boolean(id)),
      ...voiceCloneLogs.map((row) => row.id),
    ]),
  ];

  const [voiceIdByLogId, previewByLogId, aiSpacePreviewByLogId] = await Promise.all([
    loadVoiceIdByLogIds(logIds),
    loadPreviewByLogIds(logIds),
    loadPreviewFromAiSpaceByLogIds(logIds),
  ]);

  const templateLogIds = new Set<string>();

  for (const row of templates) {
    const template = rowToJson(row);
    const mediaUrl = resolveTemplatePreviewUrl(
      template,
      previewByLogId,
      aiSpacePreviewByLogId,
      row.gatewayRequestLogId,
      row.thumbnailUrl,
    );
    if (!mediaUrl) continue;

    const catalogId = `tpl-${template.id}`;
    if (seenCatalog.has(catalogId)) continue;
    seenCatalog.add(catalogId);

    let voiceId = readCloneVoiceIdFromTemplate(template);
    if (!voiceId && row.gatewayRequestLogId) {
      voiceId = voiceIdByLogId.get(row.gatewayRequestLogId) ?? "";
    }
    const prompt = template.reference?.prompt?.text?.trim();
    rows.push({
      id: catalogId,
      name: trimLabel(prompt || template.title || "声音克隆"),
      mediaUrl,
      clonedAt: template.output?.createdAt || template.createdAt,
      voiceId: voiceId || undefined,
    });

    if (row.gatewayRequestLogId) templateLogIds.add(row.gatewayRequestLogId);
  }

  for (const row of voiceCloneLogs) {
    if (templateLogIds.has(row.id)) continue;
    const mediaUrl = resolveLogPreviewUrl(
      row.resultSummary,
      row.id,
      previewByLogId,
      aiSpacePreviewByLogId,
    );
    if (!mediaUrl) continue;
    const draft = readVoiceCloneDraftFromLog(row.inputSummary);
    const voiceId = resolveVoiceIdFromLog(row.inputSummary, row.resultSummary);
    const catalogId = `job-${row.id}`;
    if (seenCatalog.has(catalogId)) continue;
    seenCatalog.add(catalogId);
    rows.push({
      id: catalogId,
      name: trimLabel(draft?.prompt || draft?.title || voiceId || "声音克隆"),
      mediaUrl,
      clonedAt: row.submittedAt.toISOString(),
      voiceId: voiceId || undefined,
    });
  }

  return rows.sort((a, b) => b.clonedAt.localeCompare(a.clonedAt));
}

export function dedupeVoiceCloneUploadRows(
  rows: QrVoiceCloneUploadRow[],
): QrVoiceCloneUploadRow[] {
  const byUrl = new Map<string, QrVoiceCloneUploadRow>();
  for (const row of rows) {
    const url = row.mediaUrl.trim();
    if (!url) continue;
    const prev = byUrl.get(url);
    if (!prev || row.clonedAt >= prev.clonedAt) byUrl.set(url, row);
  }
  return [...byUrl.values()].sort((a, b) => b.clonedAt.localeCompare(a.clonedAt));
}
