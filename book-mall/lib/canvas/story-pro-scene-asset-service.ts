import { prisma } from "@/lib/prisma";
import type { StoryProSceneAssetRefKind } from "@prisma/client";

export class StoryProSceneAssetError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_INPUT" | "LOCKED",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "StoryProSceneAssetError";
  }
}

export type StoryProSceneAssetRefRecord = {
  id: string;
  kind: StoryProSceneAssetRefKind;
  ossUrl: string;
  sortOrder: number;
  label: string | null;
  sourceTaskId: string | null;
  createdAt: string;
};

export type StoryProSceneAssetRecord = {
  id: string;
  sceneKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  refs: StoryProSceneAssetRefRecord[];
  createdAt: string;
  updatedAt: string;
};

function toRefRecord(row: {
  id: string;
  kind: StoryProSceneAssetRefKind;
  ossUrl: string;
  sortOrder: number;
  label: string | null;
  sourceTaskId: string | null;
  createdAt: Date;
}): StoryProSceneAssetRefRecord {
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
  sceneKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  refs: Parameters<typeof toRefRecord>[0][];
}): StoryProSceneAssetRecord {
  return {
    id: row.id,
    sceneKey: row.sceneKey,
    displayName: row.displayName,
    projectId: row.projectId,
    locked: row.locked,
    version: row.version,
    refs: row.refs.map(toRefRecord),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeStoryProSceneKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "";
  const sep = "::";
  const i = trimmed.indexOf(sep);
  if (i > 0) {
    const hub = trimmed.slice(0, i).trim().toLowerCase();
    const namePart = trimmed.slice(i + sep.length).trim();
    const name = namePart.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
    return name ? `${hub}${sep}${name}` : hub;
  }
  return trimmed.toLowerCase().replace(/\s+/g, "-").slice(0, 80);
}

export async function listStoryProSceneAssets(
  userId: string,
  opts?: { projectId?: string | null },
): Promise<StoryProSceneAssetRecord[]> {
  const projectId = opts?.projectId?.trim() || null;
  const rows = await prisma.storyProSceneAsset.findMany({
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

export async function upsertStoryProSceneAssetRef(
  userId: string,
  args: {
    sceneKey: string;
    displayName: string;
    projectId?: string | null;
    kind: StoryProSceneAssetRefKind;
    ossUrl: string;
    label?: string | null;
    sourceTaskId?: string | null;
  },
): Promise<StoryProSceneAssetRecord> {
  const sceneKey = normalizeStoryProSceneKey(args.sceneKey);
  const displayName = args.displayName.trim().slice(0, 80);
  const ossUrl = args.ossUrl.trim();
  const projectId = args.projectId?.trim() || null;
  if (!sceneKey || !displayName) {
    throw new StoryProSceneAssetError(
      "INVALID_INPUT",
      "sceneKey and displayName required",
    );
  }
  if (!/^https?:\/\//.test(ossUrl)) {
    throw new StoryProSceneAssetError("INVALID_INPUT", "ossUrl must be http(s)");
  }

  const existing = await prisma.storyProSceneAsset.findFirst({
    where: { userId, sceneKey, projectId },
    include: { refs: true },
  });

  if (existing?.locked) {
    throw new StoryProSceneAssetError(
      "LOCKED",
      "场景资产已锁定，无法修改",
      403,
    );
  }

  let assetId: string;
  if (existing) {
    assetId = existing.id;
    if (existing.displayName !== displayName) {
      await prisma.storyProSceneAsset.update({
        where: { id: existing.id },
        data: { displayName },
      });
    }
  } else {
    const created = await prisma.storyProSceneAsset.create({
      data: { userId, sceneKey, displayName, projectId },
    });
    assetId = created.id;
  }

  const refCount = await prisma.storyProSceneAssetRef.count({
    where: { assetId, kind: args.kind },
  });
  await prisma.storyProSceneAssetRef.create({
    data: {
      assetId,
      kind: args.kind,
      ossUrl,
      sortOrder: refCount,
      label: args.label?.trim() || null,
      sourceTaskId: args.sourceTaskId?.trim() || null,
    },
  });
  await prisma.storyProSceneAsset.update({
    where: { id: assetId },
    data: { version: { increment: 1 } },
  });

  const full = await prisma.storyProSceneAsset.findUniqueOrThrow({
    where: { id: assetId },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toAssetRecord(full);
}

export async function setStoryProSceneAssetLocked(
  userId: string,
  assetId: string,
  locked: boolean,
): Promise<StoryProSceneAssetRecord> {
  const row = await prisma.storyProSceneAsset.findFirst({
    where: { id: assetId, userId },
  });
  if (!row) {
    throw new StoryProSceneAssetError("NOT_FOUND", "场景资产不存在", 404);
  }
  const updated = await prisma.storyProSceneAsset.update({
    where: { id: assetId },
    data: { locked },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toAssetRecord(updated);
}

export async function deleteStoryProSceneAssetRef(
  userId: string,
  refId: string,
): Promise<StoryProSceneAssetRecord> {
  const ref = await prisma.storyProSceneAssetRef.findUnique({
    where: { id: refId },
    include: { asset: true },
  });
  if (!ref || ref.asset.userId !== userId) {
    throw new StoryProSceneAssetError("NOT_FOUND", "参考图不存在", 404);
  }
  if (ref.asset.locked) {
    throw new StoryProSceneAssetError(
      "LOCKED",
      "场景资产已锁定，无法删除参考图",
      403,
    );
  }
  await prisma.storyProSceneAssetRef.delete({ where: { id: refId } });
  await prisma.storyProSceneAsset.update({
    where: { id: ref.assetId },
    data: { version: { increment: 1 } },
  });
  const full = await prisma.storyProSceneAsset.findUniqueOrThrow({
    where: { id: ref.assetId },
    include: { refs: { orderBy: { sortOrder: "asc" } } },
  });
  return toAssetRecord(full);
}
