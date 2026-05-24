/**
 * 用户保存的三视图角色 CRUD。
 */
import { prisma } from "@/lib/prisma";

export class CanvasCharacterError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_INPUT",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "CanvasCharacterError";
  }
}

const MAX_NAME = 80;

export type CanvasCharacterRecord = {
  id: string;
  name: string;
  imageUrl: string;
  model: string | null;
  sourceTaskId: string | null;
  sourceProjectId: string | null;
  createdAt: string;
  updatedAt: string;
};

function toRecord(row: {
  id: string;
  name: string;
  imageUrl: string;
  model: string | null;
  sourceTaskId: string | null;
  sourceProjectId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CanvasCharacterRecord {
  return {
    id: row.id,
    name: row.name,
    imageUrl: row.imageUrl,
    model: row.model,
    sourceTaskId: row.sourceTaskId,
    sourceProjectId: row.sourceProjectId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCanvasCharacters(
  userId: string,
): Promise<CanvasCharacterRecord[]> {
  const rows = await prisma.canvasCharacter.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map(toRecord);
}

export async function createCanvasCharacter(
  userId: string,
  args: {
    name: string;
    imageUrl: string;
    model?: string | null;
    sourceTaskId?: string | null;
    sourceProjectId?: string | null;
  },
): Promise<CanvasCharacterRecord> {
  const name = args.name.trim();
  const imageUrl = args.imageUrl.trim();
  if (!name || name.length > MAX_NAME) {
    throw new CanvasCharacterError(
      "INVALID_INPUT",
      `name required (max ${MAX_NAME} chars)`,
    );
  }
  if (!imageUrl.startsWith("http://") && !imageUrl.startsWith("https://")) {
    throw new CanvasCharacterError("INVALID_INPUT", "imageUrl must be http(s)");
  }
  const row = await prisma.canvasCharacter.create({
    data: {
      userId,
      name,
      imageUrl,
      model: args.model?.trim() || null,
      sourceTaskId: args.sourceTaskId?.trim() || null,
      sourceProjectId: args.sourceProjectId?.trim() || null,
    },
  });
  return toRecord(row);
}

export async function deleteCanvasCharacter(
  userId: string,
  id: string,
): Promise<void> {
  const row = await prisma.canvasCharacter.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!row) {
    throw new CanvasCharacterError("NOT_FOUND", "character not found", 404);
  }
  await prisma.canvasCharacter.delete({ where: { id } });
}
