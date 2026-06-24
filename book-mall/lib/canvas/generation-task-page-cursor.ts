import type { Prisma } from "@prisma/client";

export const GENERATION_RECORD_PAGE_DEFAULT = 20;
export const GENERATION_RECORD_PAGE_MAX = 100;

export function parseGenerationRecordLimit(raw: string | null | undefined): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return GENERATION_RECORD_PAGE_DEFAULT;
  return Math.min(Math.max(Math.floor(n), 1), GENERATION_RECORD_PAGE_MAX);
}

export function encodeGenerationTaskCursor(row: {
  createdAt: Date;
  id: string;
}): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
  ).toString("base64url");
}

export function parseGenerationTaskCursor(
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

export function buildGenerationTaskCursorWhere(
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
