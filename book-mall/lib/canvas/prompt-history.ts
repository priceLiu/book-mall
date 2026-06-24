import type {
  CanvasGenerationKind,
  CanvasGenerationStatus,
  Prisma,
} from "@prisma/client";

import { assertAccessibleCanvasProject } from "./canvas-project-access";
import { findGenerationTaskRows } from "./canvas-generation-task-query";
import { resolveGenerationRecordLabels } from "./generation-record-labels";
import { resolveGenerationRecordPreview } from "./generation-record-preview";

export type PromptHistoryMediaKind = "TEXT" | "IMAGE" | "VIDEO";
export type PromptHistoryOutcome = "success" | "failed";

export type CanvasPromptHistoryItem = {
  id: string;
  projectId: string;
  projectName?: string;
  nodeId: string;
  promptText: string;
  mediaKind: PromptHistoryMediaKind;
  status: "SUCCEEDED" | "FAILED";
  modelLabel: string;
  providerLabel: string;
  failMessage: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

const TERMINAL_STATUSES: CanvasGenerationStatus[] = ["SUCCEEDED", "FAILED"];

const PROMPT_FIELD_KEYS = [
  "prompt",
  "themeInput",
  "videoPrompt",
  "userText",
  "text",
  "outline",
] as const;

function readPayload(inputPayload: unknown): Record<string, unknown> | null {
  if (!inputPayload || typeof inputPayload !== "object" || Array.isArray(inputPayload)) {
    return null;
  }
  return inputPayload as Record<string, unknown>;
}

export function extractPromptTextFromPayload(args: {
  inputPayload: unknown;
  kind?: CanvasGenerationKind;
  textOutput?: string | null;
}): string {
  const payload = readPayload(args.inputPayload);
  if (payload) {
    for (const key of PROMPT_FIELD_KEYS) {
      const v = payload[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
    const nestedInput = payload.input;
    if (nestedInput && typeof nestedInput === "object" && !Array.isArray(nestedInput)) {
      const nestedPrompt = (nestedInput as Record<string, unknown>).prompt;
      if (typeof nestedPrompt === "string" && nestedPrompt.trim()) {
        return nestedPrompt.trim();
      }
    }
  }
  if (args.kind === "TEXT" && args.textOutput?.trim()) {
    return args.textOutput.trim().slice(0, 2000);
  }
  return "";
}

export function inferPromptMediaKind(args: {
  kind: CanvasGenerationKind;
  inputPayload: unknown;
  previewKind?: "image" | "video" | null;
}): PromptHistoryMediaKind {
  const payload = readPayload(args.inputPayload);
  const payloadKind = typeof payload?.kind === "string" ? payload.kind : "";
  const modelKey = typeof payload?.modelKey === "string" ? payload.modelKey : "";

  if (
    args.kind === "TEXT" ||
    payloadKind === "ai-engine" ||
    payloadKind === "llm-engine" ||
    payloadKind === "text-engine" ||
    payloadKind === "story-llm"
  ) {
    return "TEXT";
  }

  if (
    payloadKind === "video-engine" ||
    payloadKind === "ai-video-engine" ||
    args.previewKind === "video" ||
    /seedance|video|r2v/i.test(modelKey)
  ) {
    return "VIDEO";
  }

  return "IMAGE";
}

function mapRowToPromptHistoryItem(
  row: Awaited<ReturnType<typeof findGenerationTaskRows>>[number],
  projectName?: string,
): CanvasPromptHistoryItem | null {
  if (row.status !== "SUCCEEDED" && row.status !== "FAILED") return null;

  const archivedText = row.archivePromptText?.trim();
  const archivedKind = parseMediaKind(row.archiveMediaKind ?? undefined);
  const preview = resolveGenerationRecordPreview({
    ossUrl: row.ossUrl,
    ephemeralUrl: row.ephemeralUrl,
    inputPayload: row.inputPayload,
  });
  const promptText =
    archivedText ||
    extractPromptTextFromPayload({
      inputPayload: row.inputPayload,
      kind: row.kind,
      textOutput: row.textOutput,
    });
  if (!promptText) return null;

  const labels = resolveGenerationRecordLabels({
    model: row.model,
    inputPayload: row.inputPayload,
    failMessage: row.failMessage,
  });

  return {
    id: row.id,
    projectId: row.projectId,
    projectName,
    nodeId: row.nodeId,
    promptText,
    mediaKind:
      archivedKind ??
      inferPromptMediaKind({
        kind: row.kind,
        inputPayload: row.inputPayload,
        previewKind: preview.previewKind,
      }),
    status: row.status,
    modelLabel: labels.modelLabel,
    providerLabel: labels.providerLabel,
    failMessage: row.failMessage,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function parseMediaKind(raw: string | null | undefined): PromptHistoryMediaKind | null {
  const v = raw?.trim().toUpperCase();
  if (v === "TEXT" || v === "IMAGE" || v === "VIDEO") return v;
  return null;
}

function parseOutcome(raw: string | null | undefined): PromptHistoryOutcome | null {
  const v = raw?.trim().toLowerCase();
  if (v === "success" || v === "failed") return v;
  return null;
}

export const PROMPT_HISTORY_DEFAULT_LIMIT = 20;
export const PROMPT_HISTORY_MAX_LIMIT = 100;

export type PromptHistoryPage = {
  items: CanvasPromptHistoryItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

function parseLimit(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return PROMPT_HISTORY_DEFAULT_LIMIT;
  return Math.min(Math.max(Math.floor(n), 1), PROMPT_HISTORY_MAX_LIMIT);
}

function encodePromptHistoryCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
  ).toString("base64url");
}

function parsePromptHistoryCursor(
  raw: string | null | undefined,
): { createdAt: Date; id: string } | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(
      Buffer.from(raw.trim(), "base64url").toString("utf8"),
    ) as { createdAt?: string; id?: string };
    const createdAt = j.createdAt ? new Date(j.createdAt) : null;
    const id = typeof j.id === "string" ? j.id.trim() : "";
    if (!createdAt || Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

function buildPromptHistoryCursorWhere(
  cursor: { createdAt: Date; id: string } | null,
): Prisma.CanvasGenerationTaskWhereInput | undefined {
  if (!cursor) return undefined;
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

async function fetchPromptHistoryPageLegacy(args: {
  baseWhere: Prisma.CanvasGenerationTaskWhereInput;
  orderBy: Prisma.CanvasGenerationTaskOrderByWithRelationInput;
  includeProjectName?: boolean;
  projectIdForRows?: string;
  mediaKind?: PromptHistoryMediaKind;
  limit: number;
  cursor?: string | null;
  mapProjectName?: (row: Awaited<ReturnType<typeof findGenerationTaskRows>>[number]) => string | undefined;
}): Promise<PromptHistoryPage> {
  const limit = args.limit;
  const cursor = parsePromptHistoryCursor(args.cursor);
  const batchSize = Math.min(limit * 4, 120);
  const items: CanvasPromptHistoryItem[] = [];
  let scanCursor = cursor;
  let lastScannedRow: Awaited<ReturnType<typeof findGenerationTaskRows>>[number] | null =
    null;
  let exhausted = false;

  for (let round = 0; round < 6 && items.length < limit; round++) {
    const cursorWhere = buildPromptHistoryCursorWhere(scanCursor);
    const where: Prisma.CanvasGenerationTaskWhereInput = cursorWhere
      ? { AND: [args.baseWhere, cursorWhere] }
      : args.baseWhere;

    const rows = await findGenerationTaskRows({
      where,
      orderBy: args.orderBy,
      take: batchSize,
      includeProjectName: args.includeProjectName,
      projectIdForRows: args.projectIdForRows,
    });

    if (rows.length === 0) {
      exhausted = true;
      break;
    }

    for (const row of rows) {
      lastScannedRow = row;
      const projectName = args.mapProjectName?.(row) ?? row.project?.name;
      const item = mapRowToPromptHistoryItem(row, projectName);
      if (!item) continue;
      if (args.mediaKind && item.mediaKind !== args.mediaKind) continue;
      items.push(item);
      if (items.length >= limit) break;
    }

    if (items.length >= limit) {
      exhausted = rows.length < batchSize;
      break;
    }

    if (rows.length < batchSize) {
      exhausted = true;
      break;
    }

    if (lastScannedRow) {
      scanCursor = {
        createdAt: lastScannedRow.createdAt,
        id: lastScannedRow.id,
      };
    }
  }

  const hasMore = !exhausted && items.length > 0;
  const nextCursor =
    hasMore && lastScannedRow
      ? encodePromptHistoryCursor({
          createdAt: lastScannedRow.createdAt,
          id: lastScannedRow.id,
        })
      : null;

  return { items, hasMore, nextCursor };
}

async function fetchPromptHistoryPage(args: {
  baseWhere: Prisma.CanvasGenerationTaskWhereInput;
  orderBy: Prisma.CanvasGenerationTaskOrderByWithRelationInput;
  includeProjectName?: boolean;
  projectIdForRows?: string;
  mediaKind?: PromptHistoryMediaKind;
  limit: number;
  cursor?: string | null;
  mapProjectName?: (row: Awaited<ReturnType<typeof findGenerationTaskRows>>[number]) => string | undefined;
}): Promise<PromptHistoryPage> {
  const limit = args.limit;
  const cursor = parsePromptHistoryCursor(args.cursor);
  const cursorWhere = buildPromptHistoryCursorWhere(cursor);
  const indexedWhere: Prisma.CanvasGenerationTaskWhereInput = {
    AND: [
      args.baseWhere,
      { archivePromptText: { not: null } },
      ...(args.mediaKind ? [{ archiveMediaKind: args.mediaKind }] : []),
      ...(cursorWhere ? [cursorWhere] : []),
    ],
  };

  const rows = await findGenerationTaskRows({
    where: indexedWhere,
    orderBy: args.orderBy,
    take: limit + 1,
    includeProjectName: args.includeProjectName,
    projectIdForRows: args.projectIdForRows,
  });

  const pageRows = rows.slice(0, limit);
  const items: CanvasPromptHistoryItem[] = [];
  for (const row of pageRows) {
    const projectName = args.mapProjectName?.(row) ?? row.project?.name;
    const item = mapRowToPromptHistoryItem(row, projectName);
    if (item) items.push(item);
  }

  const hasMore = rows.length > limit;
  const lastRow = pageRows[pageRows.length - 1] ?? null;
  const nextCursor =
    hasMore && lastRow
      ? encodePromptHistoryCursor({
          createdAt: lastRow.createdAt,
          id: lastRow.id,
        })
      : null;

  return { items, hasMore, nextCursor };
}

async function fetchPromptHistoryPageSafe(
  args: Parameters<typeof fetchPromptHistoryPage>[0],
): Promise<PromptHistoryPage> {
  try {
    return await fetchPromptHistoryPage(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("archivePromptText") ||
      msg.includes("archiveMediaKind") ||
      msg.includes("does not exist")
    ) {
      return fetchPromptHistoryPageLegacy(args);
    }
    throw err;
  }
}

export async function listProjectPromptHistory(args: {
  userId: string;
  projectId: string;
  mediaKind?: PromptHistoryMediaKind;
  outcome?: PromptHistoryOutcome;
  limit?: number;
  cursor?: string | null;
}): Promise<PromptHistoryPage> {
  await assertAccessibleCanvasProject(args.userId, args.projectId);
  const limit = parseLimit(String(args.limit ?? PROMPT_HISTORY_DEFAULT_LIMIT));
  const statusFilter =
    args.outcome === "success"
      ? ["SUCCEEDED" as const]
      : args.outcome === "failed"
        ? ["FAILED" as const]
        : TERMINAL_STATUSES;

  return fetchPromptHistoryPageSafe({
    baseWhere: {
      projectId: args.projectId,
      deletedAt: null,
      status: { in: statusFilter },
    },
    orderBy: { createdAt: "desc" },
    projectIdForRows: args.projectId,
    mediaKind: args.mediaKind,
    limit,
    cursor: args.cursor,
  });
}

export async function listUserPromptHistory(args: {
  userId: string;
  mediaKind?: PromptHistoryMediaKind;
  outcome?: PromptHistoryOutcome;
  limit?: number;
  cursor?: string | null;
}): Promise<PromptHistoryPage> {
  const limit = parseLimit(String(args.limit ?? PROMPT_HISTORY_DEFAULT_LIMIT));
  const statusFilter =
    args.outcome === "success"
      ? ["SUCCEEDED" as const]
      : args.outcome === "failed"
        ? ["FAILED" as const]
        : TERMINAL_STATUSES;

  return fetchPromptHistoryPageSafe({
    baseWhere: {
      deletedAt: null,
      status: { in: statusFilter },
      project: { userId: args.userId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    includeProjectName: true,
    mediaKind: args.mediaKind,
    limit,
    cursor: args.cursor,
  });
}

export function parsePromptHistoryQuery(searchParams: URLSearchParams): {
  mediaKind?: PromptHistoryMediaKind;
  outcome?: PromptHistoryOutcome;
  limit?: number;
  cursor?: string;
} {
  const mediaKind = parseMediaKind(searchParams.get("mediaKind"));
  const outcome = parseOutcome(searchParams.get("outcome"));
  const limitRaw = searchParams.get("limit");
  const cursor = searchParams.get("cursor")?.trim() || undefined;
  return {
    ...(mediaKind ? { mediaKind } : {}),
    ...(outcome ? { outcome } : {}),
    ...(limitRaw ? { limit: parseLimit(limitRaw) } : {}),
    ...(cursor ? { cursor } : {}),
  };
}
