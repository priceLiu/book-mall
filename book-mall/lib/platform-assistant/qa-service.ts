/**
 * AI 小智 · 管理员问答库（匹配 + CRUD）。
 * 价格 / 计费 / 财务类问题仍由 guardrails 拦截，不可入库。
 */
import type { PlatformAssistantQaMatchMode } from "@prisma/client";

import { isSensitiveTopic } from "@/lib/platform-assistant/guardrails";
import { prisma } from "@/lib/prisma";

const CACHE_MS = 30_000;
let cachedEntries: PlatformAssistantQaEntryView[] | null = null;
let cachedAt = 0;

export type PlatformAssistantQaEntryView = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
  sortOrder: number;
  question: string;
  answer: string;
  matchMode: PlatformAssistantQaMatchMode;
  matchKeywords: string[];
  sourceFeedbackId: string | null;
  updatedByUserId: string | null;
  adminNote: string | null;
};

export type UpsertAssistantQaInput = {
  question: string;
  answer: string;
  enabled?: boolean;
  sortOrder?: number;
  matchMode?: PlatformAssistantQaMatchMode;
  matchKeywords?: string[];
  sourceFeedbackId?: string | null;
  adminNote?: string | null;
};

function toView(row: {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  enabled: boolean;
  sortOrder: number;
  question: string;
  answer: string;
  matchMode: PlatformAssistantQaMatchMode;
  matchKeywords: string[];
  sourceFeedbackId: string | null;
  updatedByUserId: string | null;
  adminNote: string | null;
}): PlatformAssistantQaEntryView {
  return {
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
    question: row.question,
    answer: row.answer,
    matchMode: row.matchMode,
    matchKeywords: [...row.matchKeywords],
    sourceFeedbackId: row.sourceFeedbackId,
    updatedByUserId: row.updatedByUserId,
    adminNote: row.adminNote,
  };
}

function invalidateQaCache() {
  cachedEntries = null;
  cachedAt = 0;
}

/** 用于匹配：去空白、小写、去常见标点。 */
export function normalizeAssistantQaText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s？?。．.!！,，、；;：:""''「」【】()（）[\]{}<>《》]+/g, "");
}

export function qaEntryMatchesQuery(
  entry: Pick<
    PlatformAssistantQaEntryView,
    "question" | "matchMode" | "matchKeywords"
  >,
  query: string,
): boolean {
  const q = normalizeAssistantQaText(query);
  if (!q) return false;

  const questionNorm = normalizeAssistantQaText(entry.question);
  if (!questionNorm && entry.matchMode !== "KEYWORDS") return false;

  switch (entry.matchMode) {
    case "EXACT":
      return q === questionNorm;
    case "CONTAINS":
      return q.includes(questionNorm) || questionNorm.includes(q);
    case "KEYWORDS": {
      const keywords = entry.matchKeywords
        .map((k) => normalizeAssistantQaText(k))
        .filter(Boolean);
      if (keywords.length === 0) return false;
      return keywords.every((k) => q.includes(k));
    }
    default:
      return false;
  }
}

export function matchCuratedAssistantAnswer(
  query: string,
  entries: PlatformAssistantQaEntryView[],
): string | null {
  const trimmed = query.trim();
  if (!trimmed || isSensitiveTopic(trimmed)) return null;

  for (const entry of entries) {
    if (!entry.enabled) continue;
    if (qaEntryMatchesQuery(entry, trimmed)) {
      return entry.answer.trim();
    }
  }
  return null;
}

async function loadEnabledQaEntries(): Promise<PlatformAssistantQaEntryView[]> {
  const now = Date.now();
  if (cachedEntries && now - cachedAt < CACHE_MS) {
    return cachedEntries;
  }

  const rows = await prisma.platformAssistantQaEntry.findMany({
    where: { enabled: true },
    orderBy: [{ sortOrder: "desc" }, { updatedAt: "desc" }],
  });
  cachedEntries = rows.map(toView);
  cachedAt = now;
  return cachedEntries;
}

export async function resolveCuratedAssistantAnswer(
  query: string,
): Promise<string | null> {
  const entries = await loadEnabledQaEntries();
  return matchCuratedAssistantAnswer(query, entries);
}

export async function listAssistantQaEntries(
  limit = 200,
): Promise<PlatformAssistantQaEntryView[]> {
  const rows = await prisma.platformAssistantQaEntry.findMany({
    orderBy: [{ sortOrder: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
  return rows.map(toView);
}

function validateQaInput(input: UpsertAssistantQaInput) {
  const question = input.question.trim();
  const answer = input.answer.trim();
  if (!question) throw new Error("请填写问题");
  if (!answer) throw new Error("请填写回答");
  if (question.length > 2000) throw new Error("问题过长（最多 2000 字）");
  if (answer.length > 8000) throw new Error("回答过长（最多 8000 字）");
  if (isSensitiveTopic(question)) {
    throw new Error("价格 / 计费 / 财务类问题请引导用户查看报价页，不可在此维护答案");
  }
  if (isSensitiveTopic(answer)) {
    throw new Error("回答内容涉及价格 / 计费 / 财务，请改用报价页说明");
  }

  const matchMode = input.matchMode ?? "CONTAINS";
  const matchKeywords =
    input.matchKeywords?.map((k) => k.trim()).filter(Boolean).slice(0, 20) ?? [];

  if (matchMode === "KEYWORDS" && matchKeywords.length === 0) {
    throw new Error("关键词匹配模式至少需要一个关键词");
  }

  return {
    question,
    answer,
    enabled: input.enabled ?? true,
    sortOrder: Number.isFinite(input.sortOrder) ? Number(input.sortOrder) : 0,
    matchMode,
    matchKeywords,
    sourceFeedbackId: input.sourceFeedbackId?.trim() || null,
    adminNote: input.adminNote?.trim().slice(0, 2000) ?? null,
  };
}

export async function createAssistantQaEntry(
  input: UpsertAssistantQaInput,
  adminUserId: string,
) {
  const data = validateQaInput(input);
  invalidateQaCache();
  const row = await prisma.platformAssistantQaEntry.create({
    data: {
      ...data,
      updatedByUserId: adminUserId,
    },
  });
  return toView(row);
}

export async function updateAssistantQaEntry(
  id: string,
  input: UpsertAssistantQaInput,
  adminUserId: string,
) {
  const data = validateQaInput(input);
  invalidateQaCache();
  const row = await prisma.platformAssistantQaEntry.update({
    where: { id },
    data: {
      ...data,
      updatedByUserId: adminUserId,
    },
  });
  return toView(row);
}

export async function deleteAssistantQaEntry(id: string) {
  invalidateQaCache();
  await prisma.platformAssistantQaEntry.delete({ where: { id } });
}

export async function getAssistantQaSummary() {
  const [total, enabled] = await Promise.all([
    prisma.platformAssistantQaEntry.count(),
    prisma.platformAssistantQaEntry.count({ where: { enabled: true } }),
  ]);
  return { total, enabled };
}

/** 测试用：清空进程内缓存。 */
export function resetAssistantQaCacheForTests() {
  invalidateQaCache();
}
