import { prisma } from "@/lib/prisma";
import { normalizeStoryProCharacterKey } from "@/lib/canvas/story-pro-character-asset-service";

export class StoryProAudioAssetError extends Error {
  constructor(
    public code: "NOT_FOUND" | "INVALID_INPUT" | "LOCKED",
    message: string,
    public httpStatus = 400,
  ) {
    super(message);
    this.name = "StoryProAudioAssetError";
  }
}

export type StoryProCharacterAudioAssetRecord = {
  id: string;
  characterKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  voiceLabel: string | null;
  voiceId: string | null;
  sampleOssUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

function toRecord(row: {
  id: string;
  characterKey: string;
  displayName: string;
  projectId: string | null;
  locked: boolean;
  version: number;
  voiceLabel: string | null;
  voiceId: string | null;
  sampleOssUrl: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): StoryProCharacterAudioAssetRecord {
  return {
    id: row.id,
    characterKey: row.characterKey,
    displayName: row.displayName,
    projectId: row.projectId,
    locked: row.locked,
    version: row.version,
    voiceLabel: row.voiceLabel,
    voiceId: row.voiceId,
    sampleOssUrl: row.sampleOssUrl,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listStoryProCharacterAudioAssets(
  userId: string,
  opts?: { projectId?: string | null },
): Promise<StoryProCharacterAudioAssetRecord[]> {
  const projectId = opts?.projectId?.trim() || null;
  const rows = await prisma.storyProCharacterAudioAsset.findMany({
    where: {
      userId,
      OR: [{ projectId }, { projectId: null }],
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return rows.map(toRecord);
}

export async function upsertStoryProCharacterAudioAsset(
  userId: string,
  args: {
    characterKey: string;
    displayName: string;
    projectId?: string | null;
    voiceLabel?: string | null;
    voiceId?: string | null;
    sampleOssUrl?: string | null;
    notes?: string | null;
  },
): Promise<StoryProCharacterAudioAssetRecord> {
  const characterKey = normalizeStoryProCharacterKey(args.characterKey);
  const displayName = args.displayName.trim().slice(0, 80);
  const projectId = args.projectId?.trim() || null;
  const sampleOssUrl = args.sampleOssUrl?.trim() || null;
  if (!characterKey || !displayName) {
    throw new StoryProAudioAssetError(
      "INVALID_INPUT",
      "characterKey and displayName required",
    );
  }
  if (sampleOssUrl && !/^https?:\/\//.test(sampleOssUrl)) {
    throw new StoryProAudioAssetError("INVALID_INPUT", "sampleOssUrl must be http(s)");
  }

  const existing = await prisma.storyProCharacterAudioAsset.findFirst({
    where: { userId, characterKey, projectId },
  });
  if (existing?.locked) {
    throw new StoryProAudioAssetError(
      "LOCKED",
      "角色音频资产已锁定，无法修改",
      403,
    );
  }

  const data = {
    displayName,
    voiceLabel: args.voiceLabel?.trim() || null,
    voiceId: args.voiceId?.trim() || null,
    sampleOssUrl,
    notes: args.notes?.trim() || null,
    version: existing ? { increment: 1 } : undefined,
  };

  const row = existing
    ? await prisma.storyProCharacterAudioAsset.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.storyProCharacterAudioAsset.create({
        data: {
          userId,
          characterKey,
          projectId,
          displayName,
          voiceLabel: data.voiceLabel,
          voiceId: data.voiceId,
          sampleOssUrl: data.sampleOssUrl,
          notes: data.notes,
        },
      });

  return toRecord(row);
}

export async function setStoryProCharacterAudioAssetLocked(
  userId: string,
  assetId: string,
  locked: boolean,
): Promise<StoryProCharacterAudioAssetRecord> {
  const row = await prisma.storyProCharacterAudioAsset.findFirst({
    where: { id: assetId, userId },
  });
  if (!row) {
    throw new StoryProAudioAssetError("NOT_FOUND", "角色音频资产不存在", 404);
  }
  const updated = await prisma.storyProCharacterAudioAsset.update({
    where: { id: assetId },
    data: { locked },
  });
  return toRecord(updated);
}
