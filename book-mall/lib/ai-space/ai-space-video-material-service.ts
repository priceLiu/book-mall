/**
 * 我的 AI 空间 · 视频创作库
 *
 * 设计见 doc/product/我的AI空间.md §4.3：
 * - 本表 **只存** 用户真正拥有的新文件：`upload`（自拍）与 `compose_output`（合成成片）
 * - 各应用已发布视频 **不** 落本表，一律经 AiSpacePin 引用；列表接口把两者合并展示
 */

import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { prisma } from "@/lib/prisma";
import { runFfprobe } from "@/lib/media/ffmpeg-exec";

import { AI_SPACE_PIN_SOURCE_LABEL } from "./ai-space-pin-types";
import { cascadeDeletePinsBySource, listPins } from "./ai-space-pin-service";
import { countBlockRefsBySource } from "./ai-space-space-refs";
import {
  AI_SPACE_VIDEO_CATEGORY_LABEL,
  type AiSpaceVideoCategory,
  type AiSpaceVideoLibraryItem,
  type AiSpaceVideoMaterialDto,
} from "./ai-space-video-types";

export type {
  AiSpaceVideoCategory,
  AiSpaceVideoLibraryItem,
  AiSpaceVideoMaterialDto,
} from "./ai-space-video-types";

const NAME_MAX = 160;

/** 探测视频时长；失败返回 0 */
export async function probeVideoDurationSec(
  buffer: Buffer,
  ext: string,
): Promise<number> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "ai-space-video-"));
    const file = join(dir, `probe.${ext || "mp4"}`);
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
    console.warn("[ai-space] probeVideoDurationSec failed", e);
    return 0;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function toDto(row: {
  id: string;
  name: string;
  category: string;
  videoUrl: string;
  durationSec: number;
  sourceKind: string;
  composeTaskId: string | null;
  createdAt: Date;
}): AiSpaceVideoMaterialDto {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    videoUrl: row.videoUrl,
    durationSec: row.durationSec,
    sourceKind: row.sourceKind,
    composeTaskId: row.composeTaskId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createAiSpaceVideoMaterial(args: {
  userId: string;
  tenantId?: string | null;
  name: string;
  category: AiSpaceVideoCategory;
  videoUrl: string;
  durationSec: number;
  sourceKind?: "upload" | "compose_output";
  composeTaskId?: string | null;
  meta?: Record<string, unknown> | null;
}): Promise<AiSpaceVideoMaterialDto> {
  const row = await prisma.aiSpaceVideoMaterial.create({
    data: {
      userId: args.userId,
      tenantId: args.tenantId ?? null,
      ownerUserId: args.userId,
      name: args.name.trim().slice(0, NAME_MAX) || "未命名视频",
      category: args.category,
      videoUrl: args.videoUrl,
      durationSec: args.durationSec,
      sourceKind: args.sourceKind ?? "upload",
      composeTaskId: args.composeTaskId ?? null,
      meta: (args.meta ?? undefined) as never,
    },
  });
  return toDto(row);
}

export async function listAiSpaceVideoMaterials(
  userId: string,
  opts?: { category?: AiSpaceVideoCategory },
): Promise<AiSpaceVideoMaterialDto[]> {
  const rows = await prisma.aiSpaceVideoMaterial.findMany({
    where: { userId, ...(opts?.category ? { category: opts.category } : {}) },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  return rows.map(toDto);
}

/**
 * 合并视图：本库自有记录 + 作品墙上所有视频类 Pin。
 * Pin 项只读（真源在各应用），列表用 `origin` 区分可操作性。
 */
export async function listAiSpaceVideoLibrary(
  userId: string,
): Promise<AiSpaceVideoLibraryItem[]> {
  const [materials, pins] = await Promise.all([
    listAiSpaceVideoMaterials(userId),
    listPins(userId),
  ]);

  const items: AiSpaceVideoLibraryItem[] = materials.map((m) => ({
    origin: "material",
    id: m.id,
    name: m.name,
    category: m.category,
    videoUrl: m.videoUrl,
    thumbnailUrl: null,
    durationSec: m.durationSec,
    createdAt: m.createdAt,
    sourceLabel: null,
  }));

  for (const pin of pins) {
    if (pin.resolved.kind !== "video") continue;
    // 视频创作库自有记录的 Pin 已在 materials 中出现，避免重复行
    if (pin.sourceType === "ai_space_video") continue;
    items.push({
      origin: "pin",
      id: pin.pinId,
      name: pin.caption ?? pin.resolved.title ?? "未命名视频",
      category: "published",
      videoUrl: pin.resolved.mediaUrl,
      thumbnailUrl: pin.resolved.thumbnailUrl,
      durationSec: pin.resolved.durationSec,
      createdAt: pin.resolved.createdAt,
      sourceLabel: AI_SPACE_PIN_SOURCE_LABEL[pin.sourceType] ?? pin.sourceApp,
    });
  }

  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** 分组标签：`published` 为 Pin 引用组，其余取分类中文名 */
export function aiSpaceVideoCategoryLabel(category: string): string {
  if (category === "published") return "各应用已发布（作品墙引用）";
  return AI_SPACE_VIDEO_CATEGORY_LABEL[category] ?? category;
}

export async function updateAiSpaceVideoMaterial(
  userId: string,
  id: string,
  patch: { name?: string; category?: AiSpaceVideoCategory },
): Promise<boolean> {
  const data: { name?: string; category?: string } = {};
  if (patch.name !== undefined) {
    data.name = patch.name.trim().slice(0, NAME_MAX) || "未命名视频";
  }
  if (patch.category !== undefined) data.category = patch.category;
  if (Object.keys(data).length === 0) return false;

  const res = await prisma.aiSpaceVideoMaterial.updateMany({
    where: { id, userId },
    data,
  });
  return res.count > 0;
}

/** 删除前引用检测：作为背景被合成任务引用 */
export async function checkAiSpaceVideoMaterialReferences(
  userId: string,
  id: string,
): Promise<{
  composeTaskCount: number;
  composeTaskStatuses: string[];
  blockRefCount: number;
}> {
  const [tasks, blockRefs] = await Promise.all([
    prisma.aiSpaceComposeTask.findMany({
      where: { userId, videoMaterialId: id },
      select: { status: true },
      take: 50,
    }),
    countBlockRefsBySource({
      userId,
      sourceType: "ai_space_video",
      sourceIds: [id],
    }),
  ]);
  return {
    composeTaskCount: tasks.length,
    composeTaskStatuses: [...new Set(tasks.map((t) => t.status))],
    blockRefCount: blockRefs[id] ?? 0,
  };
}

/** 删除视频；同时级联删除其在作品墙的展示 */
export async function deleteAiSpaceVideoMaterial(
  userId: string,
  id: string,
): Promise<{ deleted: boolean; videoUrl: string | null }> {
  const row = await prisma.aiSpaceVideoMaterial.findFirst({
    where: { id, userId },
    select: { id: true, videoUrl: true },
  });
  if (!row) return { deleted: false, videoUrl: null };

  await cascadeDeletePinsBySource("ai_space_video", row.id);
  await prisma.aiSpaceVideoMaterial.delete({ where: { id: row.id } });

  const stillReferenced = await prisma.aiSpaceVideoMaterial.count({
    where: { videoUrl: row.videoUrl },
  });
  return { deleted: true, videoUrl: stillReferenced > 0 ? null : row.videoUrl };
}

export async function getAiSpaceVideoMaterial(
  userId: string,
  id: string,
): Promise<AiSpaceVideoMaterialDto | null> {
  const row = await prisma.aiSpaceVideoMaterial.findFirst({ where: { id, userId } });
  return row ? toDto(row) : null;
}
