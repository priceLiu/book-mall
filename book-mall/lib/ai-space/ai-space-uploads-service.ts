/**
 * 我的 AI 空间 · 本地上传素材汇总
 *
 * 聚合用户在 AI 空间各入口直接上传的文件，以及快速复制声音克隆试听：
 * - 音频库 sourceType=upload | voice_clone
 * - 视频创作库 sourceKind=upload
 * - 数字人库（均为上传形象图）
 */

import { prisma } from "@/lib/prisma";
import { listQrVoiceCloneUploadRows, dedupeVoiceCloneUploadRows } from "@/lib/quick-replica/qr-voice-clone-records";

import { AI_SPACE_VIDEO_CATEGORY_LABEL } from "./ai-space-video-types";

export type AiSpaceUploadKind = "audio" | "video" | "image";

export type AiSpaceUploadItem = {
  id: string;
  kind: AiSpaceUploadKind;
  name: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  durationSec: number | null;
  subtitle: string;
  createdAt: string;
  manageHref: string;
};

export async function listAiSpaceUploads(userId: string): Promise<AiSpaceUploadItem[]> {
  const [audios, videos, humans] = await Promise.all([
    prisma.aiSpaceAudioAsset.findMany({
      where: { userId, sourceType: { in: ["upload", "voice_clone"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        audioUrl: true,
        durationSec: true,
        sourceType: true,
        meta: true,
        createdAt: true,
      },
    }),
    prisma.aiSpaceVideoMaterial.findMany({
      where: { userId, sourceKind: "upload" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        videoUrl: true,
        durationSec: true,
        category: true,
        createdAt: true,
      },
    }),
    prisma.aiSpaceDigitalHuman.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        avatarImageUrl: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const items: AiSpaceUploadItem[] = [];

  for (const row of audios) {
    const meta = row.meta as { voiceId?: string } | null;
    const voiceHint = meta?.voiceId?.trim();
    items.push({
      id: row.id,
      kind: "audio",
      name: row.name,
      mediaUrl: row.audioUrl,
      thumbnailUrl: null,
      durationSec: row.durationSec > 0 ? row.durationSec : null,
      subtitle:
        row.sourceType === "voice_clone"
          ? voiceHint
            ? `声音克隆 · ${voiceHint}`
            : "声音克隆 · 快速复制"
          : "音频 · 本地上传",
      createdAt: row.createdAt.toISOString(),
      manageHref: "/account/ai-space?tab=audio",
    });
  }

  for (const row of videos) {
    const cat =
      AI_SPACE_VIDEO_CATEGORY_LABEL[row.category as keyof typeof AI_SPACE_VIDEO_CATEGORY_LABEL] ??
      row.category;
    items.push({
      id: row.id,
      kind: "video",
      name: row.name,
      mediaUrl: row.videoUrl,
      thumbnailUrl: null,
      durationSec: row.durationSec > 0 ? row.durationSec : null,
      subtitle: `视频 · ${cat}`,
      createdAt: row.createdAt.toISOString(),
      manageHref: "/account/ai-space?tab=videos",
    });
  }

  const humanStatusLabel: Record<string, string> = {
    active: "可用",
    inactive: "已停用",
    detect_failed: "检测未通过",
  };

  for (const row of humans) {
    const status = humanStatusLabel[row.status] ?? row.status;
    items.push({
      id: row.id,
      kind: "image",
      name: row.name,
      mediaUrl: row.avatarImageUrl,
      thumbnailUrl: row.avatarImageUrl,
      durationSec: null,
      subtitle: `形象图 · ${status}`,
      createdAt: row.createdAt.toISOString(),
      manageHref: "/account/ai-space?tab=digital-humans",
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const coveredIds = new Set(items.map((i) => i.id));
  const coveredMediaUrls = new Set(items.filter((i) => i.kind === "audio").map((i) => i.mediaUrl));
  const cloneRows = dedupeVoiceCloneUploadRows(await listQrVoiceCloneUploadRows(userId));
  for (const row of cloneRows) {
    if (coveredIds.has(row.id) || coveredMediaUrls.has(row.mediaUrl)) continue;
    items.push({
      id: row.id,
      kind: "audio",
      name: row.name,
      mediaUrl: row.mediaUrl,
      thumbnailUrl: null,
      durationSec: null,
      subtitle: row.voiceId ? `声音克隆 · ${row.voiceId}` : "声音克隆 · 我的作品",
      createdAt: row.clonedAt,
      manageHref: "/account/ai-space?tab=audio",
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}
