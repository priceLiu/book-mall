/**
 * 我的 AI 空间 · 数字人形象库（Book 平台真源）
 *
 * 各应用只存 `digitalHumanId` 引用本表，不复制形象文件。
 * 形象尺寸门禁与 wan2.2-s2v 对齐：最短边 > 400px、最长边 < 7000px。
 */

import sharp from "sharp";

import { prisma } from "@/lib/prisma";

import {
  AI_SPACE_DIGITAL_HUMAN_MAX_EDGE,
  AI_SPACE_DIGITAL_HUMAN_MIN_EDGE,
  type AiSpaceDigitalHumanDto,
  type AiSpaceDigitalHumanStatus,
} from "./ai-space-digital-human-types";
import { readDigitalHumanDetect } from "./ai-space-s2v-detect-service";

export type {
  AiSpaceDigitalHumanDetect,
  AiSpaceDigitalHumanDto,
  AiSpaceDigitalHumanStatus,
} from "./ai-space-digital-human-types";

const NAME_MAX = 120;

export class AiSpaceDigitalHumanError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiSpaceDigitalHumanError";
  }
}

type DigitalHumanMeta = { width?: number; height?: number } | null;

export function toAiSpaceDigitalHumanDto(row: {
  id: string;
  name: string;
  avatarImageUrl: string;
  status: string;
  meta: unknown;
  createdAt: Date;
}): AiSpaceDigitalHumanDto {
  const meta = (row.meta ?? null) as DigitalHumanMeta;
  return {
    id: row.id,
    name: row.name,
    avatarImageUrl: row.avatarImageUrl,
    status: row.status,
    width: typeof meta?.width === "number" ? meta.width : null,
    height: typeof meta?.height === "number" ? meta.height : null,
    detect: readDigitalHumanDetect(row.meta, row.avatarImageUrl),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 校验形象图尺寸（S2V 入口门禁），返回宽高供 meta 存档。
 * 尺寸不合规直接抛错，避免无效厂商调用。
 */
export async function assertDigitalHumanImageSize(
  buffer: Buffer,
): Promise<{ width: number; height: number }> {
  const meta = await sharp(buffer, { failOn: "none" }).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (!width || !height) {
    throw new AiSpaceDigitalHumanError("无法识别图片尺寸，请换一张形象图", 400);
  }
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  if (shortEdge <= AI_SPACE_DIGITAL_HUMAN_MIN_EDGE) {
    throw new AiSpaceDigitalHumanError(
      `形象图最短边需大于 ${AI_SPACE_DIGITAL_HUMAN_MIN_EDGE}px，当前 ${shortEdge}px`,
      400,
    );
  }
  if (longEdge >= AI_SPACE_DIGITAL_HUMAN_MAX_EDGE) {
    throw new AiSpaceDigitalHumanError(
      `形象图最长边需小于 ${AI_SPACE_DIGITAL_HUMAN_MAX_EDGE}px，当前 ${longEdge}px`,
      400,
    );
  }
  return { width, height };
}

export async function createAiSpaceDigitalHuman(args: {
  userId: string;
  tenantId?: string | null;
  name: string;
  avatarImageUrl: string;
  width?: number | null;
  height?: number | null;
}): Promise<AiSpaceDigitalHumanDto> {
  const row = await prisma.aiSpaceDigitalHuman.create({
    data: {
      userId: args.userId,
      tenantId: args.tenantId ?? null,
      ownerUserId: args.userId,
      name: args.name.trim().slice(0, NAME_MAX) || "未命名数字人",
      avatarImageUrl: args.avatarImageUrl,
      status: "active",
      meta: {
        ...(args.width ? { width: args.width } : {}),
        ...(args.height ? { height: args.height } : {}),
      },
    },
  });
  return toAiSpaceDigitalHumanDto(row);
}

export async function listAiSpaceDigitalHumans(
  userId: string,
  opts?: { activeOnly?: boolean },
): Promise<AiSpaceDigitalHumanDto[]> {
  const rows = await prisma.aiSpaceDigitalHuman.findMany({
    where: {
      userId,
      ...(opts?.activeOnly ? { status: "active" } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return rows.map(toAiSpaceDigitalHumanDto);
}

export async function getAiSpaceDigitalHuman(
  userId: string,
  id: string,
): Promise<AiSpaceDigitalHumanDto | null> {
  const row = await prisma.aiSpaceDigitalHuman.findFirst({ where: { id, userId } });
  return row ? toAiSpaceDigitalHumanDto(row) : null;
}

export async function updateAiSpaceDigitalHuman(
  userId: string,
  id: string,
  patch: { name?: string; status?: AiSpaceDigitalHumanStatus },
): Promise<boolean> {
  const data: { name?: string; status?: string } = {};
  if (patch.name !== undefined) {
    data.name = patch.name.trim().slice(0, NAME_MAX) || "未命名数字人";
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (Object.keys(data).length === 0) return false;

  const res = await prisma.aiSpaceDigitalHuman.updateMany({
    where: { id, userId },
    data,
  });
  return res.count > 0;
}

/** 删除前引用检测：形象被合成任务引用时须提示用户 */
export async function checkAiSpaceDigitalHumanReferences(
  userId: string,
  id: string,
): Promise<{ composeTaskCount: number; composeTaskStatuses: string[] }> {
  const tasks = await prisma.aiSpaceComposeTask.findMany({
    where: { userId, digitalHumanId: id },
    select: { status: true },
    take: 50,
  });
  return {
    composeTaskCount: tasks.length,
    composeTaskStatuses: [...new Set(tasks.map((t) => t.status))],
  };
}

/** 删除形象；返回 avatarImageUrl 供调用方清理 OSS（无其它记录共用时） */
export async function deleteAiSpaceDigitalHuman(
  userId: string,
  id: string,
): Promise<{ deleted: boolean; avatarImageUrl: string | null }> {
  const row = await prisma.aiSpaceDigitalHuman.findFirst({
    where: { id, userId },
    select: { id: true, avatarImageUrl: true },
  });
  if (!row) return { deleted: false, avatarImageUrl: null };

  await prisma.aiSpaceFavorite.deleteMany({
    where: { userId, targetKind: "digital_human", targetId: row.id },
  });

  await prisma.aiSpaceDigitalHuman.delete({ where: { id: row.id } });
  const stillReferenced = await prisma.aiSpaceDigitalHuman.count({
    where: { avatarImageUrl: row.avatarImageUrl },
  });
  return {
    deleted: true,
    avatarImageUrl: stillReferenced > 0 ? null : row.avatarImageUrl,
  };
}
