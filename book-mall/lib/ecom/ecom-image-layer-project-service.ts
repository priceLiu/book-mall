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
      title: opts?.title?.trim() || "图片分层",
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
  const row: ImageLayerProjectGeneration = {
    id: entry.id ?? randomUUID(),
    at: entry.at ?? new Date().toISOString(),
    kind: entry.kind,
    title: entry.title,
    ossUrl: entry.ossUrl,
    prompt: entry.prompt ?? null,
    logId: entry.logId ?? null,
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
      modelKey: ECOM_IMAGE_LAYER_MODEL,
    },
  }).catch(() => undefined);

  return rowToDto(updated);
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
