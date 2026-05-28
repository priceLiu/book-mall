import { prisma } from "@/lib/prisma";
import type { StoryProCharacterAssetRefKind } from "@prisma/client";

export class StoryProCharacterAssetError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_INPUT" | "LOCKED",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "StoryProCharacterAssetError";
  }
}

export type StoryProCharacterAssetRefRecord = {
  id: string;
  kind: StoryProCharacterAssetRefKind;
  ossUrl: string;
  sortOrder: number;
  label: string | null;
  sourceTaskId: string | null;
  createdAt: string;
};

export type StoryProCharacterAssetRecord = {
  id: string;
  characterKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  refs: StoryProCharacterAssetRefRecord[];
  createdAt: string;
  updatedAt: string;
};

function toRefRecord(row: {
  id: string;
  kind: StoryProCharacterAssetRefKind;
  ossUrl: string;
  sortOrder: number;
  label: string | null;
  sourceTaskId: string | null;
  createdAt: Date;
}): StoryProCharacterAssetRefRecord {
  return {
    id: row.id,
    kind: row.kind,
    ossUrl: row.ossUrl,
    sortOrder: row.sortOrder,
    label: row.label,
    sourceTaskId: row.sourceTaskId,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAssetRecord(row: {
  id: string;
  characterKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  refs: Parameters<typeof toRefRecord>[0][];
}): StoryProCharacterAssetRecord {
  return {
    id: row.id,
    characterKey: row.characterKey,
    displayName: row.displayName,
    projectId: row.projectId,
    locked: row.locked,
    version: row.version,
    refs: row.refs.map(toRefRecord),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeStoryProCharacterKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export async function listStoryProCharacterAssets(
  userId: string,
  opts?: { projectId?: string | null },
): Promise<StoryProCharacterAssetRecord[]> {
  const projectId = opts?.projectId?.trim() || null;
  const rows = await prisma.storyProCharacterAsset.findMany({
    where: {
      userId,
      OR: [{ projectId }, { projectId: null }],
    },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map(toAssetRecord);
}

export async function upsertStoryProCharacterAssetRef(
  userId: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    kind: StoryProCharacterAssetRefKind;
    ossUrl: string;
    label?: string | null;
    sourceTaskId?: string | null;
  },
): Promise<StoryProCharacterAssetRecord> {
  const characterKey = normalizeStoryProCharacterKey(args.characterKey);
  const displayName = args.displayName.trim().slice(0, 80);
  const ossUrl = args.ossUrl.trim();
  const projectId = args.projectId?.trim() || null;
  if (!characterKey || !displayName) {
    throw new StoryProCharacterAssetError(
      "INVALID_INPUT",
      "characterKey and displayName required",
    );
  }
  if (!/^https?:\/\//.test(ossUrl)) {
    throw new StoryProCharacterAssetError("INVALID_INPUT", "ossUrl must be http(s)");
  }

  const existing = await prisma.storyProCharacterAsset.findFirst({
    where: { userId, characterKey, projectId },
    include: { refs: true },
  });

  if (existing?.locked) {
    throw new StoryProCharacterAssetError(
      "LOCKED",
      "角色资产已锁定，无法修改",
      403,
    );
  }

  let assetId: string;
  if (existing) {
    assetId = existing.id;
    if (existing.displayName !== displayName) {
      await prisma.storyProCharacterAsset.update({
        where: { id: existing.id },
        data: { displayName },
      });
    }
  } else {
    const created = await prisma.storyProCharacterAsset.create({
      data: { userId, characterKey, displayName, projectId },
    });
    assetId = created.id;
  }

  const refCount = await prisma.storyProCharacterAssetRef.count({
    where: { assetId, kind: args.kind },
  });
  await prisma.storyProCharacterAssetRef.create({
    data: {
      assetId,
      kind: args.kind,
      ossUrl,
      sortOrder: refCount,
      label: args.label?.trim() || null,
      sourceTaskId: args.sourceTaskId?.trim() || null,
    },
  });
  await prisma.storyProCharacterAsset.update({
    where: { id: assetId },
    data: { version: { increment: 1 } },
  });

  const full = await prisma.storyProCharacterAsset.findUniqueOrThrow({
    where: { id: assetId },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toAssetRecord(full);
}

async function loadOwnedAsset(userId: string, assetId: string) {
  const row = await prisma.storyProCharacterAsset.findFirst({
    where: { id: assetId, userId },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  if (!row) {
    throw new StoryProCharacterAssetError("NOT_FOUND", "角色资产不存在", 404);
  }
  return row;
}

export async function setStoryProCharacterAssetLocked(
  userId: string,
  assetId: string,
  locked: boolean,
): Promise<StoryProCharacterAssetRecord> {
  await loadOwnedAsset(userId, assetId);
  const updated = await prisma.storyProCharacterAsset.update({
    where: { id: assetId },
    data: { locked },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toAssetRecord(updated);
}

export async function deleteStoryProCharacterAssetRef(
  userId: string,
  refId: string,
): Promise<StoryProCharacterAssetRecord> {
  const ref = await prisma.storyProCharacterAssetRef.findUnique({
    where: { id: refId },
    include: { asset: true },
  });
  if (!ref || ref.asset.userId !== userId) {
    throw new StoryProCharacterAssetError("NOT_FOUND", "参考图不存在", 404);
  }
  if (ref.asset.locked) {
    throw new StoryProCharacterAssetError(
      "LOCKED",
      "角色资产已锁定，无法删除参考图",
      403,
    );
  }
  await prisma.storyProCharacterAssetRef.delete({ where: { id: refId } });
  await prisma.storyProCharacterAsset.update({
    where: { id: ref.assetId },
    data: { version: { increment: 1 } },
  });
  const full = await prisma.storyProCharacterAsset.findUniqueOrThrow({
    where: { id: ref.assetId },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toAssetRecord(full);
}
