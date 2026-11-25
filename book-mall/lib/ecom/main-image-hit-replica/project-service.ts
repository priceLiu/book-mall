import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { prisma } from "@/lib/prisma";

import { parseMeta, parseOutput, parseSettings, sanitizeReferences } from "./parse";
import {
  DEFAULT_MAIN_IMAGE_HIT_REPLICA_SETTINGS,
  ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE,
  MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT_IMAGES,
  MAIN_IMAGE_HIT_REPLICA_MAX_REF_IMAGES,
  type MainImageHitReplicaMeta,
  type MainImageHitReplicaOutput,
  type MainImageHitReplicaProject,
  type MainImageHitReplicaReference,
  type MainImageHitReplicaResult,
  type MainImageHitReplicaSettings,
} from "./types";

import { withMainImageHitReplicaOutputLock } from "./project-output-lock";

type Row = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: unknown;
  references: unknown;
  output: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: Row): MainImageHitReplicaProject {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    settings: parseSettings(row.settings),
    references: sanitizeReferences(row.references),
    output: parseOutput(row.output),
    meta: parseMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function projects() {
  const d = prisma.ecomMainImageHitReplicaProject;
  if (!d) {
    throw new Error(
      "Prisma 未包含 EcomMainImageHitReplicaProject，请在 book-mall 执行 pnpm db:generate 与 db:apply-pending",
    );
  }
  return d;
}

export async function listMainImageHitReplicaSummaries(userId: string) {
  const rows = await projects().findMany({
    where: { userId, module: ECOM_MAIN_IMAGE_HIT_REPLICA_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, output: true },
  });
  return rows.map((row) => {
    const refs = sanitizeReferences(row.references);
    const out = parseOutput(row.output);
    const thumb =
      out.results.find((r) => r.imageUrl)?.imageUrl ??
      refs.find((r) => r.role === "reference")?.ossUrl ??
      refs[0]?.ossUrl ??
      null;
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      thumbnailUrl: thumb,
    };
  });
}

export async function createMainImageHitReplicaProject(
  userId: string,
  opts?: { title?: string },
): Promise<MainImageHitReplicaProject> {
  const row = await projects().create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "爆款图复刻",
      settings: DEFAULT_MAIN_IMAGE_HIT_REPLICA_SETTINGS as unknown as Prisma.InputJsonValue,
      references: [] as Prisma.InputJsonValue,
      output: { results: [] } as Prisma.InputJsonValue,
      meta: { phase: "setup" } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getMainImageHitReplicaProject(
  userId: string,
  projectId: string,
): Promise<MainImageHitReplicaProject | null> {
  const row = await projects().findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  return rowToDto(row);
}

export async function updateMainImageHitReplicaProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    status?: string;
    settings?: Partial<MainImageHitReplicaSettings>;
    references?: MainImageHitReplicaReference[];
    output?: MainImageHitReplicaOutput;
    meta?: Partial<{ [K in keyof MainImageHitReplicaMeta]: MainImageHitReplicaMeta[K] | null }>;
  },
): Promise<MainImageHitReplicaProject | null> {
  const existing = await getMainImageHitReplicaProject(userId, projectId);
  if (!existing) return null;

  const settings = patch.settings
    ? { ...existing.settings, ...patch.settings }
    : existing.settings;
  const meta = patch.meta ? { ...existing.meta, ...patch.meta } : existing.meta;
  if (patch.meta) {
    for (const [key, val] of Object.entries(patch.meta)) {
      if (val === null) {
        delete (meta as Record<string, unknown>)[key];
      }
    }
  }
  const output = patch.output ?? existing.output;

  const row = await projects().update({
    where: { id: projectId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      settings: settings as unknown as Prisma.InputJsonValue,
      ...(patch.references
        ? { references: patch.references as unknown as Prisma.InputJsonValue }
        : {}),
      output: output as unknown as Prisma.InputJsonValue,
      meta: meta as unknown as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function deleteMainImageHitReplicaProject(
  userId: string,
  projectId: string,
): Promise<boolean> {
  const existing = await getMainImageHitReplicaProject(userId, projectId);
  if (!existing) return false;
  await projects().delete({ where: { id: projectId } });
  return true;
}

export async function uploadMainImageHitReplicaRef(
  userId: string,
  projectId: string,
  file: Buffer,
  mime: string,
  role: "reference" | "product",
  label: string,
): Promise<MainImageHitReplicaProject | null> {
  const project = await getMainImageHitReplicaProject(userId, projectId);
  if (!project) return null;
  const refs = [...project.references];
  const sameRole = refs.filter((r) => r.role === role);
  const max =
    role === "reference"
      ? MAIN_IMAGE_HIT_REPLICA_MAX_REF_IMAGES
      : MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT_IMAGES;
  if (sameRole.length >= max) {
    throw new Error(
      role === "reference"
        ? `参考图最多 ${MAIN_IMAGE_HIT_REPLICA_MAX_REF_IMAGES} 张`
        : `产品原图最多 ${MAIN_IMAGE_HIT_REPLICA_MAX_PRODUCT_IMAGES} 张`,
    );
  }
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    buf: file,
    contentType: mime || "image/jpeg",
    ext,
  });
  const refIndex = sameRole.length + 1;
  refs.push({
    id: randomUUID(),
    role,
    label:
      label.trim() ||
      (role === "reference" ? `图${refIndex}` : `产品图${refIndex > 1 ? refIndex : ""}`),
    ossUrl,
    sortIndex: refs.length,
  });
  return updateMainImageHitReplicaProject(userId, projectId, { references: refs });
}

export async function patchMainImageHitReplicaResultSlot(
  userId: string,
  projectId: string,
  resultId: string,
  patch: Partial<MainImageHitReplicaResult>,
): Promise<MainImageHitReplicaProject | null> {
  return withMainImageHitReplicaOutputLock(projectId, async () => {
    const existing = await getMainImageHitReplicaProject(userId, projectId);
    if (!existing) return null;
    const results = existing.output.results.map((r) =>
      r.id === resultId ? { ...r, ...patch } : r,
    );
    return updateMainImageHitReplicaProject(userId, projectId, {
      output: { results },
    });
  });
}

export async function removeMainImageHitReplicaRef(
  userId: string,
  projectId: string,
  refId: string,
): Promise<MainImageHitReplicaProject | null> {
  const project = await getMainImageHitReplicaProject(userId, projectId);
  if (!project) return null;
  const refs = project.references
    .filter((r) => r.id !== refId)
    .map((r, i) => ({ ...r, sortIndex: i }));
  return updateMainImageHitReplicaProject(userId, projectId, { references: refs });
}