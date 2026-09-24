import { randomUUID } from "crypto";

import { Prisma } from "@prisma/client";

import {
  ECOM_IMAGE_LAYER_MODEL,
  ECOM_IMAGE_LAYER_TOOL_KEY,
} from "@/lib/ecom/ecom-image-layer-service";
import {
  ECOM_IMAGE_LAYER_MODULE,
  sanitizeImageLayerGenerations,
  sanitizeImageLayerWorkspace,
  type ImageLayerProjectDto,
  type ImageLayerProjectGeneration,
  type ImageLayerWorkspace,
} from "@/lib/ecom/ecom-image-layer-project-types";
import { persistEcomGenerationRecord } from "@/lib/ecom/ecom-generation-record";
import { firstWriteOrigin } from "@/lib/ecom/ecom-first-origin";
import type { ImageLayerStack } from "@/lib/ecom/ecom-image-layer-service";
import { prisma } from "@/lib/prisma";

function rowToDto(row: {
  id: string;
  title: string | null;
  module: string;
  status: string;
  workspace: unknown;
  generations: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ImageLayerProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    workspace: sanitizeImageLayerWorkspace(row.workspace),
    generations: sanitizeImageLayerGenerations(row.generations),
    meta: (row.meta as Record<string, unknown> | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedRow(userId: string, projectId: string) {
  return prisma.ecomImageLayerProject.findFirst({
    where: { userId, id: projectId, module: ECOM_IMAGE_LAYER_MODULE },
  });
}

export async function listEcomImageLayerProjects(
  userId: string,
): Promise<ImageLayerProjectDto[]> {
  const rows = await prisma.ecomImageLayerProject.findMany({
    where: { userId, module: ECOM_IMAGE_LAYER_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function createEcomImageLayerProject(
  userId: string,
  opts?: { title?: string },
): Promise<ImageLayerProjectDto> {
  const row = await prisma.ecomImageLayerProject.create({
    data: {
      userId,
      module: ECOM_IMAGE_LAYER_MODULE,
      title: opts?.title?.trim() || "图片处理",
      workspace: {} as Prisma.InputJsonValue,
      generations: [] as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomImageLayerProject(
  userId: string,
  projectId: string,
): Promise<ImageLayerProjectDto | null> {
  const row = await getOwnedRow(userId, projectId);
  return row ? rowToDto(row) : null;
}

export async function updateEcomImageLayerProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    status: string;
    workspace: ImageLayerWorkspace;
    meta: Record<string, unknown>;
  }>,
): Promise<ImageLayerProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const prevWorkspace = sanitizeImageLayerWorkspace(existing.workspace);
  const nextWorkspace = patch.workspace
    ? { ...prevWorkspace, ...patch.workspace }
    : prevWorkspace;

  let nextMeta: Prisma.InputJsonValue | undefined;
  if (patch.meta !== undefined) {
    const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
    nextMeta = { ...prevMeta, ...patch.meta } as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomImageLayerProject.update({
    where: { id: projectId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.workspace !== undefined
        ? { workspace: nextWorkspace as Prisma.InputJsonValue }
        : {}),
      ...(nextMeta !== undefined ? { meta: nextMeta } : {}),
    },
  });
  return rowToDto(row);
}

export async function deleteEcomImageLayerProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  await prisma.ecomImageLayerProject.delete({ where: { id: projectId } });
}

export async function saveEcomImageLayerWorkspace(
  userId: string,
  projectId: string,
  workspace: ImageLayerWorkspace,
): Promise<ImageLayerProjectDto> {
  return updateEcomImageLayerProject(userId, projectId, { workspace });
}

export async function appendEcomImageLayerGeneration(
  userId: string,
  projectId: string,
  entry: Omit<ImageLayerProjectGeneration, "id" | "at"> & {
    id?: string;
    at?: string;
  },
): Promise<ImageLayerProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const prev = sanitizeImageLayerGenerations(existing.generations);
  const workspace = sanitizeImageLayerWorkspace(existing.workspace);
  const row: ImageLayerProjectGeneration = {
    id: entry.id ?? randomUUID(),
    at: entry.at ?? new Date().toISOString(),
    kind: entry.kind,
    title: entry.title,
    ossUrl: entry.ossUrl,
    prompt: entry.prompt ?? null,
    logId: entry.logId ?? null,
    modelKey: entry.modelKey ?? null,
    compareFromUrl: entry.compareFromUrl ?? null,
    ...(entry.refImages?.length ? { refImages: entry.refImages } : {}),
    ...(Object.keys(workspace).length ? { workspace } : {}),
  };
  const next = [row, ...prev.filter((g) => g.id !== row.id)].slice(0, 80);

  const updated = await prisma.ecomImageLayerProject.update({
    where: { id: projectId },
    data: { generations: next as Prisma.InputJsonValue },
  });

  await persistEcomGenerationRecord({
    userId,
    ossUrl: row.ossUrl,
    kind: "image",
    title: row.title,
    prompt: row.prompt,
    thumbnailUrl: row.ossUrl,
    meta: {
      sourceModule: ECOM_IMAGE_LAYER_MODULE,
      sourceToolKey: ECOM_IMAGE_LAYER_TOOL_KEY,
      projectId,
      sourceResultId: row.id,
      modelKey: row.modelKey ?? ECOM_IMAGE_LAYER_MODEL,
      firstOrigin: sanitizeImageLayerWorkspace(existing.workspace).firstOrigin,
    },
  }).catch(() => undefined);

  return rowToDto(updated);
}

/** 把当前结果图写入「我的资产 · 图片处理」，并记一条生成记录 */
export async function saveImageLayerResultToLibrary(
  userId: string,
  projectId: string,
  opts: { ossUrl: string; title?: string; prompt?: string | null },
): Promise<{ assetId: string; created: boolean }> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const ossUrl = opts.ossUrl.trim();
  if (!ossUrl) throw new Error("缺少结果图");
  const title = opts.title?.trim() || "图片处理结果";
  const workspace = sanitizeImageLayerWorkspace(existing.workspace);
  const savedImages = [
    ...(workspace.savedImages ?? []),
  ];
  if (!savedImages.some((row) => row.url === ossUrl)) {
    savedImages.push({
      url: ossUrl,
      title,
      at: new Date().toISOString(),
      source: "library",
    });
  }
  const savedImageIndex = Math.max(
    0,
    savedImages.findIndex((row) => row.url === ossUrl),
  );
  await updateEcomImageLayerProject(userId, projectId, {
    workspace: {
      ...workspace,
      savedImages: savedImages.slice(-40),
      savedImageIndex,
    },
  });

  const dup = await prisma.ecomAsset.findFirst({
    where: { userId, module: ECOM_IMAGE_LAYER_MODULE, ossUrl },
    select: { id: true },
  });
  if (dup) {
    return { assetId: dup.id, created: false };
  }

  const firstOrigin = firstWriteOrigin(workspace.firstOrigin, "ecom") ?? "ecom";
  const asset = await prisma.ecomAsset.create({
    data: {
      userId,
      module: ECOM_IMAGE_LAYER_MODULE,
      kind: "image",
      title: title.slice(0, 120),
      prompt: opts.prompt?.trim() || null,
      ossUrl,
      thumbnailUrl: ossUrl,
      meta: {
        sourceModule: ECOM_IMAGE_LAYER_MODULE,
        sourceToolKey: ECOM_IMAGE_LAYER_TOOL_KEY,
        projectId,
        projectName: existing.title?.trim() || "图片处理",
        firstOrigin,
      },
    },
  });

  await appendEcomImageLayerGeneration(userId, projectId, {
    kind: "edit",
    title,
    prompt: opts.prompt ?? null,
    ossUrl,
  });

  return { assetId: asset.id, created: true };
}

export function workspaceFromStack(
  stack: ImageLayerStack,
  extras?: Partial<ImageLayerWorkspace>,
): ImageLayerWorkspace {
  return {
    sourceImageUrl: stack.sourceImageUrl ?? extras?.sourceImageUrl ?? null,
    stack,
    ...extras,
  };
}
