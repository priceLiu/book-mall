import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { prisma } from "@/lib/prisma";
import {
  ECOM_SEED_VIDEO_MODULE,
  parseSeedVideoPlan,
  sanitizeSeedVideoChatMessages,
  sanitizeSeedVideoReferences,
  SEED_VIDEO_MATERIAL_MAX,
  type SeedVideoChatMessage,
  type SeedVideoPlan,
  type SeedVideoReference,
  type SeedVideoSettings,
} from "@/lib/ecom/ecom-seed-video-types";

export type EcomSeedVideoProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: SeedVideoSettings;
  references: SeedVideoReference[];
  chatHistory: SeedVideoChatMessage[];
  plan: SeedVideoPlan | null;
  videoAssetId: string | null;
  videoOssUrl: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

function rowToDto(
  row: {
    id: string;
    title: string | null;
    module: string;
    status: string;
    brief: unknown;
    settings: unknown;
    references: unknown;
    chatHistory: unknown;
    plan: unknown;
    videoAssetId: string | null;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  videoOssUrl?: string | null,
): EcomSeedVideoProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: (row.settings as SeedVideoSettings) ?? {},
    references: sanitizeSeedVideoReferences(row.references),
    chatHistory: sanitizeSeedVideoChatMessages(row.chatHistory),
    plan: parseSeedVideoPlan(row.plan),
    videoAssetId: row.videoAssetId,
    videoOssUrl: videoOssUrl ?? null,
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function loadVideoOssUrl(userId: string, assetId: string | null): Promise<string | null> {
  if (!assetId?.trim()) return null;
  const asset = await prisma.ecomAsset.findFirst({
    where: { userId, id: assetId },
    select: { ossUrl: true },
  });
  const url = asset?.ossUrl?.trim();
  return url && /^https?:\/\//.test(url) ? url : null;
}

export async function listEcomSeedVideoProjects(userId: string): Promise<EcomSeedVideoProjectDto[]> {
  const rows = await prisma.ecomSeedVideoProject.findMany({
    where: { userId, module: ECOM_SEED_VIDEO_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map((row) => rowToDto(row));
}

export async function listEcomSeedVideoProjectSummaries(userId: string) {
  const rows = await prisma.ecomSeedVideoProject.findMany({
    where: { userId, module: ECOM_SEED_VIDEO_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createEcomSeedVideoProject(
  userId: string,
  opts?: { title?: string },
): Promise<EcomSeedVideoProjectDto> {
  const row = await prisma.ecomSeedVideoProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "图片生种草视频",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      settings: {
        aspectRatio: "9:16",
        targetDurationSec: 30,
        chatModelKey: "qwen3.5-flash",
        videoModelKey: "wan2.7-r2v",
      } as Prisma.InputJsonValue,
      meta: {
        workflow: { phase: "material" },
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomSeedVideoProject(
  userId: string,
  projectId: string,
): Promise<EcomSeedVideoProjectDto | null> {
  const row = await prisma.ecomSeedVideoProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  const videoOssUrl = await loadVideoOssUrl(userId, row.videoAssetId);
  return rowToDto(row, videoOssUrl);
}

export async function updateEcomSeedVideoProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    brief?: Record<string, unknown>;
    settings?: SeedVideoSettings;
    references?: SeedVideoReference[];
    chatHistory?: SeedVideoChatMessage[];
    plan?: SeedVideoPlan | null;
    status?: string;
    videoAssetId?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<EcomSeedVideoProjectDto> {
  const existing = await prisma.ecomSeedVideoProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomSeedVideoProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 120);
  if (patch.brief !== undefined) data.brief = patch.brief as Prisma.InputJsonValue;
  if (patch.settings !== undefined) data.settings = patch.settings as Prisma.InputJsonValue;
  if (patch.references !== undefined) {
    data.references = sanitizeSeedVideoReferences(patch.references) as Prisma.InputJsonValue;
  }
  if (patch.chatHistory !== undefined) {
    data.chatHistory = sanitizeSeedVideoChatMessages(patch.chatHistory) as Prisma.InputJsonValue;
  }
  if (patch.plan !== undefined) {
    if (patch.plan === null) {
      data.plan = Prisma.JsonNull;
    } else {
      const prevPlan = parseSeedVideoPlan(existing.plan) ?? {};
      data.plan = { ...prevPlan, ...patch.plan } as Prisma.InputJsonValue;
    }
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.videoAssetId !== undefined) data.videoAssetId = patch.videoAssetId;
  if (patch.meta !== undefined) {
    const prev = (existing.meta as Record<string, unknown> | null) ?? {};
    data.meta = { ...prev, ...patch.meta } as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomSeedVideoProject.update({
    where: { id: projectId },
    data,
  });
  const videoOssUrl = await loadVideoOssUrl(userId, row.videoAssetId);
  return rowToDto(row, videoOssUrl);
}

export async function deleteEcomSeedVideoProject(userId: string, projectId: string): Promise<void> {
  const row = await prisma.ecomSeedVideoProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) throw new Error("项目不存在");
  await prisma.ecomSeedVideoProject.delete({ where: { id: projectId } });
}

export async function addSeedVideoReferenceUpload(
  userId: string,
  projectId: string,
  opts: { label: string; buf: Buffer },
): Promise<SeedVideoReference> {
  const project = await getEcomSeedVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const materials = project.references.filter((r) => r.role === "seed-material");
  if (materials.length >= SEED_VIDEO_MATERIAL_MAX) {
    throw new Error(`最多上传 ${SEED_VIDEO_MATERIAL_MAX} 张素材图`);
  }

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const ref: SeedVideoReference = {
    id: `ref-${Date.now()}-${materials.length + 1}`,
    label: opts.label.slice(0, 40) || `素材${materials.length + 1}`,
    role: "seed-material",
    ossUrl,
  };
  await updateEcomSeedVideoProject(userId, projectId, {
    references: [...project.references, ref],
  });
  return ref;
}

export async function removeSeedVideoReference(
  userId: string,
  projectId: string,
  refId: string,
): Promise<void> {
  const project = await getEcomSeedVideoProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  await updateEcomSeedVideoProject(userId, projectId, {
    references: project.references.filter((r) => r.id !== refId),
  });
}
