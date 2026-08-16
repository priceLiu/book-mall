/**
 * 我的 AI 空间 · 音频库（Book 平台真源）
 *
 * 设计见 doc/product/我的AI空间.md §4.2：
 * - 全应用共用 **一张** 音频表，项目内只存 `audioAssetId`
 * - QuickReplica 生成音频写入同一条记录，**不双存 OSS**
 * - `durationSec` 由 ffprobe 探测（合成台 20s 门禁依赖）
 */

import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import type { AssetVisibility } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { runFfprobe } from "@/lib/media/ffmpeg-exec";

/** 音频来源，与 §4.2 表定义一致 */
export type AiSpaceAudioSourceType =
  | "upload"
  | "tts"
  | "voice_clone"
  | "voice_changer"
  | "sound_effect"
  | "music";

export type AiSpaceAudioAssetDto = {
  id: string;
  name: string;
  sourceType: string;
  audioUrl: string;
  durationSec: number;
  textScript: string | null;
  originApp: string | null;
  createdAt: string;
  visibility: AssetVisibility;
};

const NAME_MAX = 160;

/** 探测音频时长；失败返回 0（不阻断入库，由合成台门禁另行提示） */
export async function probeAudioDurationSec(buffer: Buffer, ext: string): Promise<number> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "ai-space-audio-"));
    const file = join(dir, `probe.${ext || "mp3"}`);
    await writeFile(file, buffer);
    const stdout = await runFfprobe([
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file,
    ]);
    const sec = Number.parseFloat(stdout.trim());
    return Number.isFinite(sec) && sec > 0 ? Math.round(sec * 100) / 100 : 0;
  } catch (e) {
    console.warn("[ai-space] probeAudioDurationSec failed", e);
    return 0;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** 探测远端音频时长（上传已落 OSS 的场景） */
export async function probeAudioDurationSecFromUrl(url: string): Promise<number> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return 0;
    const buf = Buffer.from(await r.arrayBuffer());
    const ext = /\.(wav|m4a|mp3|aac|ogg)(\?|$)/i.exec(url)?.[1]?.toLowerCase() ?? "mp3";
    return probeAudioDurationSec(buf, ext);
  } catch (e) {
    console.warn("[ai-space] probeAudioDurationSecFromUrl failed", e);
    return 0;
  }
}

export function toAiSpaceAudioAssetDto(row: {
  id: string;
  name: string;
  sourceType: string;
  audioUrl: string;
  durationSec: number;
  textScript: string | null;
  originApp: string | null;
  createdAt: Date;
  visibility: AssetVisibility;
}): AiSpaceAudioAssetDto {
  return {
    id: row.id,
    name: row.name,
    sourceType: row.sourceType,
    audioUrl: row.audioUrl,
    durationSec: row.durationSec,
    textScript: row.textScript,
    originApp: row.originApp,
    createdAt: row.createdAt.toISOString(),
    visibility: row.visibility,
  };
}

export async function createAiSpaceAudioAsset(args: {
  userId: string;
  tenantId?: string | null;
  name: string;
  sourceType: AiSpaceAudioSourceType;
  audioUrl: string;
  durationSec: number;
  textScript?: string | null;
  originApp?: string | null;
  originRef?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<AiSpaceAudioAssetDto> {
  const row = await prisma.aiSpaceAudioAsset.create({
    data: {
      userId: args.userId,
      tenantId: args.tenantId ?? null,
      ownerUserId: args.userId,
      name: args.name.trim().slice(0, NAME_MAX) || "未命名音频",
      sourceType: args.sourceType,
      audioUrl: args.audioUrl,
      durationSec: args.durationSec,
      textScript: args.textScript?.trim() || null,
      originApp: args.originApp ?? null,
      originRef: args.originRef ?? null,
      meta: (args.meta ?? undefined) as never,
    },
  });
  return toAiSpaceAudioAssetDto(row);
}

/**
 * QuickReplica 生成音频后同步到平台音频库。
 * 失败 **不得** 影响 QR 主流程（音频已上传 OSS 且日志已写）。
 */
export async function syncQuickReplicaAudioToAiSpace(args: {
  userId: string;
  audioUrl: string;
  buffer: Buffer;
  ext: string;
  sourceType: AiSpaceAudioSourceType;
  name: string;
  textScript?: string | null;
  originRef?: string | null;
}): Promise<void> {
  try {
    const durationSec = await probeAudioDurationSec(args.buffer, args.ext);
    await createAiSpaceAudioAsset({
      userId: args.userId,
      name: args.name,
      sourceType: args.sourceType,
      audioUrl: args.audioUrl,
      durationSec,
      textScript: args.textScript ?? null,
      originApp: "quick-replica",
      originRef: args.originRef ?? null,
    });
  } catch (e) {
    console.error("[ai-space] syncQuickReplicaAudioToAiSpace failed", e);
  }
}

export async function listAiSpaceAudioAssets(
  userId: string,
  opts?: { limit?: number; maxDurationSec?: number },
): Promise<AiSpaceAudioAssetDto[]> {
  const rows = await prisma.aiSpaceAudioAsset.findMany({
    where: {
      userId,
      ...(opts?.maxDurationSec
        ? { durationSec: { gt: 0, lte: opts.maxDurationSec } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(opts?.limit ?? 200, 500),
  });
  return rows.map(toAiSpaceAudioAssetDto);
}

export async function renameAiSpaceAudioAsset(
  userId: string,
  id: string,
  name: string,
): Promise<boolean> {
  const res = await prisma.aiSpaceAudioAsset.updateMany({
    where: { id, userId },
    data: { name: name.trim().slice(0, NAME_MAX) || "未命名音频" },
  });
  return res.count > 0;
}

/**
 * 删除音频。返回其 audioUrl 供调用方清理 OSS。
 * OSS 只在该 URL 未被其它记录引用时才删（QR 与本表共用同一 URL）。
 */
export async function deleteAiSpaceAudioAsset(
  userId: string,
  id: string,
): Promise<{ deleted: boolean; audioUrl: string | null }> {
  const row = await prisma.aiSpaceAudioAsset.findFirst({
    where: { id, userId },
    select: { id: true, audioUrl: true },
  });
  if (!row) return { deleted: false, audioUrl: null };

  await prisma.aiSpaceFavorite.deleteMany({
    where: { userId, targetKind: "audio", targetId: row.id },
  });

  await prisma.aiSpaceAudioAsset.delete({ where: { id: row.id } });
  const stillReferenced = await prisma.aiSpaceAudioAsset.count({
    where: { audioUrl: row.audioUrl },
  });
  return { deleted: true, audioUrl: stillReferenced > 0 ? null : row.audioUrl };
}

/**
 * 删除前引用检测：音频被合成任务引用时须提示用户。
 * 返回引用条目的简述（合成任务状态 + 时间）。
 */
export async function checkAiSpaceAudioReferences(
  userId: string,
  id: string,
): Promise<{ composeTaskCount: number; composeTaskStatuses: string[] }> {
  const tasks = await prisma.aiSpaceComposeTask.findMany({
    where: { userId, audioAssetId: id },
    select: { status: true },
    take: 50,
  });
  return {
    composeTaskCount: tasks.length,
    composeTaskStatuses: [...new Set(tasks.map((t) => t.status))],
  };
}

/** 合成台等场景：按 id 取音频（含时长校验所需字段） */
export async function getAiSpaceAudioAsset(
  userId: string,
  id: string,
): Promise<AiSpaceAudioAssetDto | null> {
  const row = await prisma.aiSpaceAudioAsset.findFirst({ where: { id, userId } });
  return row ? toAiSpaceAudioAssetDto(row) : null;
}
