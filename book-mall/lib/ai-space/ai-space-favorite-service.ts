/**
 * 我的 AI 空间 · 收藏（与作品墙 Pin 分离）
 */

import { prisma } from "@/lib/prisma";

import {
  getAiSpaceAudioAsset,
  type AiSpaceAudioAssetDto,
} from "./ai-space-audio-service";
import {
  getAiSpaceDigitalHuman,
  type AiSpaceDigitalHumanDto,
} from "./ai-space-digital-human-service";
import {
  AI_SPACE_FAVORITE_TARGET_KINDS,
  type AiSpaceFavoriteDto,
  type AiSpaceFavoriteTargetKind,
  type AiSpaceTtsVoiceFavoriteMeta,
  isAiSpaceFavoriteTargetKind,
} from "./ai-space-favorite-types";

export class AiSpaceFavoriteError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiSpaceFavoriteError";
  }
}

function parseTtsMeta(raw: unknown): AiSpaceTtsVoiceFavoriteMeta | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.label !== "string" || !o.label.trim()) return null;
  return {
    label: o.label.trim(),
    language: typeof o.language === "string" ? o.language : null,
    previewUrl: typeof o.previewUrl === "string" ? o.previewUrl : null,
    modelKey: typeof o.modelKey === "string" ? o.modelKey : null,
    avatarLetter: typeof o.avatarLetter === "string" ? o.avatarLetter : null,
  };
}

function toFavoriteDto(row: {
  id: string;
  targetKind: string;
  targetId: string;
  meta: unknown;
  sortOrder: number;
  createdAt: Date;
}): AiSpaceFavoriteDto {
  return {
    id: row.id,
    targetKind: row.targetKind as AiSpaceFavoriteTargetKind,
    targetId: row.targetId,
    meta:
      row.targetKind === "tts_voice" ? parseTtsMeta(row.meta) : null,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getFavoriteTargetIdSet(
  userId: string,
  targetKind: AiSpaceFavoriteTargetKind,
): Promise<Set<string>> {
  const rows = await prisma.aiSpaceFavorite.findMany({
    where: { userId, targetKind },
    select: { targetId: true },
  });
  return new Set(rows.map((r) => r.targetId));
}

/** 一次读多种收藏，省掉「每种一条 findMany」——合成台一次要形象 + 音频两种 */
export async function getFavoriteTargetIdSets(
  userId: string,
  targetKinds: AiSpaceFavoriteTargetKind[],
): Promise<Record<string, Set<string>>> {
  const rows = await prisma.aiSpaceFavorite.findMany({
    where: { userId, targetKind: { in: targetKinds } },
    select: { targetKind: true, targetId: true },
  });
  const out: Record<string, Set<string>> = {};
  for (const kind of targetKinds) out[kind] = new Set<string>();
  for (const r of rows) out[r.targetKind]?.add(r.targetId);
  return out;
}

export async function attachAudioFavorites(
  userId: string,
  items: AiSpaceAudioAssetDto[],
): Promise<Array<AiSpaceAudioAssetDto & { isFavorite: boolean }>> {
  const fav = await getFavoriteTargetIdSet(userId, "audio");
  return items.map((item) => ({ ...item, isFavorite: fav.has(item.id) }));
}

export async function attachDigitalHumanFavorites(
  userId: string,
  items: AiSpaceDigitalHumanDto[],
): Promise<Array<AiSpaceDigitalHumanDto & { isFavorite: boolean }>> {
  const fav = await getFavoriteTargetIdSet(userId, "digital_human");
  return items.map((item) => ({ ...item, isFavorite: fav.has(item.id) }));
}

export type AiSpaceFavoriteEntryDto = AiSpaceFavoriteDto & {
  audio?: AiSpaceAudioAssetDto | null;
  digitalHuman?: AiSpaceDigitalHumanDto | null;
};

export async function listAiSpaceFavorites(
  userId: string,
  opts?: { targetKind?: AiSpaceFavoriteTargetKind },
): Promise<AiSpaceFavoriteEntryDto[]> {
  const rows = await prisma.aiSpaceFavorite.findMany({
    where: {
      userId,
      ...(opts?.targetKind ? { targetKind: opts.targetKind } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 300,
  });

  const entries: AiSpaceFavoriteEntryDto[] = [];
  for (const row of rows) {
    const base = toFavoriteDto(row);
    if (base.targetKind === "audio") {
      const audio = await getAiSpaceAudioAsset(userId, base.targetId);
      if (!audio) continue;
      entries.push({ ...base, audio });
    } else if (base.targetKind === "digital_human") {
      const digitalHuman = await getAiSpaceDigitalHuman(userId, base.targetId);
      if (!digitalHuman) continue;
      entries.push({ ...base, digitalHuman });
    } else {
      entries.push(base);
    }
  }
  return entries;
}

async function assertFavoriteTargetOwned(
  userId: string,
  targetKind: AiSpaceFavoriteTargetKind,
  targetId: string,
): Promise<void> {
  if (targetKind === "audio") {
    const row = await getAiSpaceAudioAsset(userId, targetId);
    if (!row) throw new AiSpaceFavoriteError("音频不存在或无权收藏", 404);
    return;
  }
  if (targetKind === "digital_human") {
    const row = await getAiSpaceDigitalHuman(userId, targetId);
    if (!row) throw new AiSpaceFavoriteError("数字人不存在或无权收藏", 404);
    return;
  }
  if (!targetId.trim()) {
    throw new AiSpaceFavoriteError("音色 ID 无效", 400);
  }
}

export async function createAiSpaceFavorite(args: {
  userId: string;
  targetKind: AiSpaceFavoriteTargetKind;
  targetId: string;
  meta?: AiSpaceTtsVoiceFavoriteMeta | null;
}): Promise<{ favorite: AiSpaceFavoriteDto; created: boolean }> {
  const targetKind = args.targetKind;
  const targetId = args.targetId.trim();
  if (!isAiSpaceFavoriteTargetKind(targetKind)) {
    throw new AiSpaceFavoriteError("不支持的收藏类型", 400);
  }
  await assertFavoriteTargetOwned(args.userId, targetKind, targetId);

  const existing = await prisma.aiSpaceFavorite.findUnique({
    where: {
      userId_targetKind_targetId: {
        userId: args.userId,
        targetKind,
        targetId,
      },
    },
  });
  if (existing) {
    return { favorite: toFavoriteDto(existing), created: false };
  }

  const maxOrder = await prisma.aiSpaceFavorite.aggregate({
    where: { userId: args.userId, targetKind },
    _max: { sortOrder: true },
  });

  const row = await prisma.aiSpaceFavorite.create({
    data: {
      userId: args.userId,
      targetKind,
      targetId,
      meta:
        targetKind === "tts_voice" && args.meta
          ? (args.meta as never)
          : undefined,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });
  return { favorite: toFavoriteDto(row), created: true };
}

export async function deleteAiSpaceFavorite(
  userId: string,
  args: { id?: string; targetKind?: AiSpaceFavoriteTargetKind; targetId?: string },
): Promise<void> {
  if (args.id) {
    const res = await prisma.aiSpaceFavorite.deleteMany({
      where: { id: args.id, userId },
    });
    if (res.count === 0) throw new AiSpaceFavoriteError("收藏不存在", 404);
    return;
  }
  if (args.targetKind && args.targetId) {
    const res = await prisma.aiSpaceFavorite.deleteMany({
      where: {
        userId,
        targetKind: args.targetKind,
        targetId: args.targetId.trim(),
      },
    });
    if (res.count === 0) throw new AiSpaceFavoriteError("收藏不存在", 404);
    return;
  }
  throw new AiSpaceFavoriteError("请指定收藏 id 或 targetKind + targetId", 400);
}

export async function deleteFavoriteByTarget(
  userId: string,
  targetKind: AiSpaceFavoriteTargetKind,
  targetId: string,
): Promise<void> {
  await prisma.aiSpaceFavorite.deleteMany({
    where: { userId, targetKind, targetId },
  });
}

export async function listFavoriteComposeMaterials(userId: string): Promise<{
  audioAssets: Array<AiSpaceAudioAssetDto & { isFavorite: true }>;
  digitalHumans: Array<AiSpaceDigitalHumanDto & { isFavorite: true }>;
}> {
  const rows = await prisma.aiSpaceFavorite.findMany({
    where: { userId, targetKind: { in: ["audio", "digital_human"] } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: 100,
  });

  const audioAssets: Array<AiSpaceAudioAssetDto & { isFavorite: true }> = [];
  const digitalHumans: Array<AiSpaceDigitalHumanDto & { isFavorite: true }> = [];

  for (const row of rows) {
    if (row.targetKind === "audio") {
      const asset = await getAiSpaceAudioAsset(userId, row.targetId);
      if (asset) audioAssets.push({ ...asset, isFavorite: true });
    } else if (row.targetKind === "digital_human") {
      const human = await getAiSpaceDigitalHuman(userId, row.targetId);
      if (human && human.status === "active") {
        digitalHumans.push({ ...human, isFavorite: true });
      }
    }
  }

  return { audioAssets, digitalHumans };
}

export { AI_SPACE_FAVORITE_TARGET_KINDS };
