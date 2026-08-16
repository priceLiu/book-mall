import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  inferKindFromOssUrl,
  newMediaRefId,
  resolveMediaDecomposeFromUrl,
  resolveMediaDecomposeUpload,
} from "@/lib/ecom/ecom-media-decompose-media";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";
import {
  ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL,
  ECOM_MEDIA_DECOMPOSE_MODULE,
  sanitizeMediaDecomposeReference,
  sanitizeMediaDecomposeResult,
  sanitizeMediaDecomposeSettings,
  type MediaDecomposeReference,
  type MediaDecomposeResult,
  type MediaDecomposeSettings,
  type MediaDecomposeProjectDto,
} from "@/lib/ecom/ecom-media-decompose-types";

function assertMediaDecomposePrismaDelegate(): void {
  const delegate = (
    prisma as unknown as {
      ecomMediaDecomposeProject?: { create?: unknown };
    }
  ).ecomMediaDecomposeProject;
  if (typeof delegate?.create !== "function") {
    throw new Error(
      "数据库客户端未包含拆图拆视频项目表，请在 book-mall 执行 pnpm db:generate 并重启 dev:all",
    );
  }
}

function rowToDto(row: {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: unknown;
  references: unknown;
  result: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): MediaDecomposeProjectDto {
  const media = sanitizeMediaDecomposeReference(row.references);
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    settings: sanitizeMediaDecomposeSettings(row.settings),
    media,
    result: sanitizeMediaDecomposeResult(row.result),
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedRow(userId: string, projectId: string) {
  return prisma.ecomMediaDecomposeProject.findFirst({
    where: { userId, id: projectId, module: ECOM_MEDIA_DECOMPOSE_MODULE },
  });
}

export async function listEcomMediaDecomposeProjects(
  userId: string,
): Promise<MediaDecomposeProjectDto[]> {
  const rows = await prisma.ecomMediaDecomposeProject.findMany({
    where: { userId, module: ECOM_MEDIA_DECOMPOSE_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function createEcomMediaDecomposeProject(
  userId: string,
  opts?: { title?: string },
): Promise<MediaDecomposeProjectDto> {
  assertMediaDecomposePrismaDelegate();
  const row = await prisma.ecomMediaDecomposeProject.create({
    data: {
      userId,
      module: ECOM_MEDIA_DECOMPOSE_MODULE,
      title: opts?.title?.trim() || "拆图拆视频",
      settings: {
        chatModelKey: ECOM_MEDIA_DECOMPOSE_DEFAULT_CHAT_MODEL,
      } as Prisma.InputJsonValue,
      references: Prisma.JsonNull,
      result: Prisma.JsonNull,
    },
  });
  return rowToDto(row);
}

export async function getEcomMediaDecomposeProject(
  userId: string,
  projectId: string,
): Promise<MediaDecomposeProjectDto | null> {
  const row = await getOwnedRow(userId, projectId);
  return row ? rowToDto(row) : null;
}

export async function updateEcomMediaDecomposeProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    settings: MediaDecomposeSettings;
    result: MediaDecomposeResult | null;
    status: string;
    meta: Record<string, unknown>;
  }>,
): Promise<MediaDecomposeProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const prevSettings = sanitizeMediaDecomposeSettings(existing.settings);
  const nextSettings = patch.settings
    ? { ...prevSettings, ...patch.settings }
    : prevSettings;

  let nextMeta: Prisma.InputJsonValue | undefined;
  if (patch.meta !== undefined) {
    const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = { ...prevMeta, ...patch.meta };
    for (const [key, value] of Object.entries(patch.meta)) {
      if (value === null) delete merged[key];
    }
    nextMeta = merged as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomMediaDecomposeProject.update({
    where: { id: projectId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.settings !== undefined
        ? { settings: nextSettings as Prisma.InputJsonValue }
        : {}),
      ...(patch.result !== undefined
        ? { result: (patch.result ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(nextMeta !== undefined ? { meta: nextMeta } : {}),
    },
  });
  return rowToDto(row);
}

export async function deleteEcomMediaDecomposeProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  await prisma.ecomMediaDecomposeProject.delete({ where: { id: projectId } });
}

async function setProjectMedia(
  userId: string,
  projectId: string,
  media: MediaDecomposeReference,
): Promise<MediaDecomposeProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
  const nextMeta = { ...prevMeta };
  delete nextMeta.replicaSeedVideoProjectId;
  delete nextMeta.replicaResultAt;

  const row = await prisma.ecomMediaDecomposeProject.update({
    where: { id: projectId },
    data: {
      references: media as Prisma.InputJsonValue,
      result: Prisma.JsonNull,
      status: "draft",
      meta: nextMeta as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function uploadMediaDecomposeMedia(
  userId: string,
  projectId: string,
  args: { buf: Buffer; contentType: string; fileName?: string; label?: string },
): Promise<MediaDecomposeProjectDto> {
  const { kind, ossUrl } = await resolveMediaDecomposeUpload({
    userId,
    buf: args.buf,
    contentType: args.contentType,
    fileName: args.fileName,
  });
  const media: MediaDecomposeReference = {
    id: newMediaRefId(),
    kind,
    ossUrl,
    source: "upload",
    label: args.label?.slice(0, 40) || (kind === "video" ? "视频素材" : "图片素材"),
  };
  return setProjectMedia(userId, projectId, media);
}

export async function setMediaDecomposeFromUrl(
  userId: string,
  projectId: string,
  url: string,
): Promise<MediaDecomposeProjectDto> {
  const { kind, ossUrl, sourceUrl } = await resolveMediaDecomposeFromUrl({ userId, url });
  const media: MediaDecomposeReference = {
    id: newMediaRefId(),
    kind,
    ossUrl,
    source: "url",
    sourceUrl,
    label: kind === "video" ? "链接视频" : "链接图片",
  };
  return setProjectMedia(userId, projectId, media);
}

export async function attachMediaDecomposeFromAsset(
  userId: string,
  projectId: string,
  assetId: string,
): Promise<MediaDecomposeProjectDto> {
  const asset = await prisma.ecomAsset.findFirst({
    where: { userId, id: assetId.trim() },
    select: { ossUrl: true, title: true, kind: true },
  });
  if (!asset?.ossUrl?.trim()) throw new Error("资产不存在或无可用 URL");

  const ossUrl = asset.ossUrl.trim();
  const kind =
    asset.kind === "video" || inferKindFromOssUrl(ossUrl) === "video" ? "video" : "image";

  const media: MediaDecomposeReference = {
    id: newMediaRefId(),
    kind,
    ossUrl,
    source: "asset",
    label: asset.title?.slice(0, 40) || "我的资产",
  };
  return setProjectMedia(userId, projectId, media);
}

export async function clearMediaDecomposeMedia(
  userId: string,
  projectId: string,
): Promise<MediaDecomposeProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  const row = await prisma.ecomMediaDecomposeProject.update({
    where: { id: projectId },
    data: {
      references: Prisma.JsonNull,
      result: Prisma.JsonNull,
      status: "draft",
    },
  });
  return rowToDto(row);
}

export async function saveMediaDecomposeResult(
  userId: string,
  projectId: string,
  result: MediaDecomposeResult,
): Promise<MediaDecomposeProjectDto> {
  return updateEcomMediaDecomposeProject(userId, projectId, {
    result,
    status: result.structured ? "completed" : "draft",
    meta: {
      replicaSeedVideoProjectId: null,
      replicaResultAt: null,
    },
  });
}

export type { MediaDecomposePatch };
