import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { prisma } from "@/lib/prisma";

import {
  emptySuite,
  parseBrief,
  parseMeta,
  parseSettings,
  parseSuite,
  sanitizeChat,
  sanitizeReferences,
} from "./parse";
import { normalizeDetailPageSuiteProject, prepareDetailPageSuitePatch } from "./suite-persist";
import { buildInitialHitSuite } from "@/lib/ecom/detail-page-suite-hit/hit-materialize";
import {
  buildInitialReplicaSuite,
  healIdleReplicaProjectBeforeDecompose,
} from "@/lib/ecom/detail-page-suite-replica/replica-materialize";

import {
  ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
  ECOM_DETAIL_PAGE_SUITE_MODULE,
  ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
  type DetailPageSuiteBrief,
  type DetailPageSuiteReferenceRole,
  type DetailPageSuiteChatMessage,
  type DetailPageSuiteMeta,
  type DetailPageSuiteProject,
  type DetailPageSuiteReference,
  type DetailPageSuiteSettings,
  type DetailPageSuiteState,
} from "./types";

type Row = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: unknown;
  settings: unknown;
  references: unknown;
  chatHistory: unknown;
  suite: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: Row): DetailPageSuiteProject {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: parseBrief(row.brief),
    settings: parseSettings(row.settings),
    references: sanitizeReferences(row.references),
    chatHistory: sanitizeChat(row.chatHistory),
    suite: parseSuite(row.suite),
    meta: parseMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDetailPageSuiteProjects(
  userId: string,
): Promise<DetailPageSuiteProject[]> {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_DETAIL_PAGE_SUITE_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listDetailPageSuiteProjectSummaries(userId: string) {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_DETAIL_PAGE_SUITE_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, suite: true },
  });
  return rows.map((row) => {
    const refs = sanitizeReferences(row.references);
    const suite = parseSuite(row.suite);
    const thumb =
      suite.modules.flatMap((m) => m.slots).find((s) => s.imageUrl)?.imageUrl ??
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

export async function createDetailPageSuiteProject(
  userId: string,
  opts?: { title?: string },
): Promise<DetailPageSuiteProject> {
  const row = await prisma.ecomDetailPageSuiteProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "详情页套图",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      suite: emptySuite() as unknown as Prisma.InputJsonValue,
      meta: { phase: "product_ref", dimensionStep: 0 } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getDetailPageSuiteProject(
  userId: string,
  id: string,
): Promise<DetailPageSuiteProject | null> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_MODULE },
  });
  if (!row) return null;
  let project = rowToDto(row);
  const healed = normalizeDetailPageSuiteProject(project);
  if (healed.changed) {
    const saved = await prisma.ecomDetailPageSuiteProject.update({
      where: { id },
      data: {
        suite: healed.project.suite as Prisma.InputJsonValue,
        meta: (healed.project.meta ?? null) as Prisma.InputJsonValue,
        brief: (healed.project.brief ?? null) as Prisma.InputJsonValue,
      },
    });
    project = rowToDto(saved);
  }
  return project;
}

export async function updateDetailPageSuiteProject(
  userId: string,
  id: string,
  patch: Partial<{
    title: string;
    status: string;
    brief: DetailPageSuiteBrief | null;
    settings: DetailPageSuiteSettings;
    references: DetailPageSuiteReference[];
    chatHistory: DetailPageSuiteChatMessage[];
    suite: DetailPageSuiteState;
    meta: DetailPageSuiteMeta | null;
  }>,
): Promise<DetailPageSuiteProject | null> {
  const existing = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_MODULE },
  });
  if (!existing) return null;
  const existingProject = rowToDto(existing);
  const normalizedPatch =
    patch.suite !== undefined
      ? prepareDetailPageSuitePatch(existingProject, {
          suite: patch.suite,
          meta: patch.meta !== undefined ? patch.meta : existingProject.meta,
        })
      : null;
  const row = await prisma.ecomDetailPageSuiteProject.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.brief !== undefined ? { brief: patch.brief as Prisma.InputJsonValue } : {}),
      ...(patch.settings !== undefined
        ? { settings: patch.settings as Prisma.InputJsonValue }
        : {}),
      ...(patch.references !== undefined
        ? { references: patch.references as Prisma.InputJsonValue }
        : {}),
      ...(patch.chatHistory !== undefined
        ? { chatHistory: patch.chatHistory as Prisma.InputJsonValue }
        : {}),
      ...(normalizedPatch?.suite !== undefined
        ? { suite: normalizedPatch.suite as Prisma.InputJsonValue }
        : patch.suite !== undefined
          ? { suite: patch.suite as Prisma.InputJsonValue }
          : {}),
      ...(normalizedPatch?.meta !== undefined
        ? { meta: normalizedPatch.meta as Prisma.InputJsonValue }
        : patch.meta !== undefined
          ? { meta: patch.meta as Prisma.InputJsonValue }
          : {}),
    },
  });
  return rowToDto(row);
}

export async function deleteDetailPageSuiteProject(
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_MODULE },
  });
  if (!row) return false;
  await prisma.ecomDetailPageSuiteProject.delete({ where: { id } });
  return true;
}

export async function uploadDetailPageSuiteReference(opts: {
  userId: string;
  projectId: string;
  buf: Buffer;
  contentType: string;
  label?: string;
}): Promise<DetailPageSuiteProject | null> {
  const { normalizeDetailPageSuiteReferenceForStorage } = await import(
    "./ref-upload-normalize"
  );
  const stored = await normalizeDetailPageSuiteReferenceForStorage(opts.buf);
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: stored.ext,
    buf: stored.buf,
    contentType: stored.contentType,
  });
  const project = await getDetailPageSuiteProject(opts.userId, opts.projectId);
  if (!project) return null;
  const next: DetailPageSuiteReference[] = [
    ...project.references,
    {
      id: randomUUID(),
      label: opts.label?.trim() || `产品图 ${project.references.length + 1}`,
      role: "product",
      ossUrl,
    },
  ];
  return updateDetailPageSuiteProject(opts.userId, opts.projectId, { references: next });
}

export async function listDetailPageSuiteReplicaProjects(
  userId: string,
): Promise<DetailPageSuiteProject[]> {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listDetailPageSuiteReplicaSummaries(userId: string) {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, suite: true },
  });
  return rows.map((row) => {
    const refs = sanitizeReferences(row.references);
    const suite = parseSuite(row.suite);
    const thumb =
      suite.modules.flatMap((m) => m.slots).find((s) => s.imageUrl)?.imageUrl ??
      refs.find((r) => r.role === "reference_suite")?.ossUrl ??
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

export async function createDetailPageSuiteReplicaProject(
  userId: string,
  opts?: { title?: string },
): Promise<DetailPageSuiteProject> {
  const row = await prisma.ecomDetailPageSuiteProject.create({
    data: {
      userId,
      module: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE,
      title: opts?.title?.trim().slice(0, 120) || "详情页套图复刻",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      suite: buildInitialReplicaSuite() as unknown as Prisma.InputJsonValue,
      meta: {
        phase: "prompts",
        replicaStatus: "idle",
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

async function loadDetailPageSuiteProjectNormalized(
  row: Row,
): Promise<DetailPageSuiteProject> {
  let project = rowToDto(row);
  const healed = normalizeDetailPageSuiteProject(project);
  if (healed.changed) {
    const saved = await prisma.ecomDetailPageSuiteProject.update({
      where: { id: row.id },
      data: {
        suite: healed.project.suite as Prisma.InputJsonValue,
        meta: (healed.project.meta ?? null) as Prisma.InputJsonValue,
        brief: (healed.project.brief ?? null) as Prisma.InputJsonValue,
      },
    });
    project = rowToDto(saved);
  }
  return project;
}

export async function getDetailPageSuiteReplicaProject(
  userId: string,
  id: string,
): Promise<DetailPageSuiteProject | null> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE },
  });
  if (!row) return null;
  const project = await loadDetailPageSuiteProjectNormalized(row);
  return healIdleReplicaProjectBeforeDecompose(project);
}

export async function updateDetailPageSuiteReplicaProject(
  userId: string,
  id: string,
  patch: Parameters<typeof updateDetailPageSuiteProject>[2],
): Promise<DetailPageSuiteProject | null> {
  const existing = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE },
  });
  if (!existing) return null;
  const existingProject = rowToDto(existing);
  const normalizedPatch =
    patch.suite !== undefined
      ? prepareDetailPageSuitePatch(existingProject, {
          suite: patch.suite,
          meta: patch.meta !== undefined ? patch.meta : existingProject.meta,
        })
      : null;
  const row = await prisma.ecomDetailPageSuiteProject.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.brief !== undefined ? { brief: patch.brief as Prisma.InputJsonValue } : {}),
      ...(patch.settings !== undefined
        ? { settings: patch.settings as Prisma.InputJsonValue }
        : {}),
      ...(patch.references !== undefined
        ? { references: patch.references as Prisma.InputJsonValue }
        : {}),
      ...(patch.chatHistory !== undefined
        ? { chatHistory: patch.chatHistory as Prisma.InputJsonValue }
        : {}),
      ...(normalizedPatch?.suite !== undefined
        ? { suite: normalizedPatch.suite as Prisma.InputJsonValue }
        : patch.suite !== undefined
          ? { suite: patch.suite as Prisma.InputJsonValue }
          : {}),
      ...(normalizedPatch?.meta !== undefined
        ? { meta: normalizedPatch.meta as Prisma.InputJsonValue }
        : patch.meta !== undefined
          ? { meta: patch.meta as Prisma.InputJsonValue }
          : {}),
    },
  });
  return rowToDto(row);
}

export async function deleteDetailPageSuiteReplicaProject(
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE },
  });
  if (!row) return false;
  await prisma.ecomDetailPageSuiteProject.delete({ where: { id } });
  return true;
}

const REPLICA_ROLE_LIMITS: Record<DetailPageSuiteReferenceRole, number> = {
  reference_suite: 1,
  product: 12,
  model: 6,
};

export async function uploadDetailPageSuiteReplicaReference(opts: {
  userId: string;
  projectId: string;
  buf: Buffer;
  contentType: string;
  label?: string;
  role: DetailPageSuiteReferenceRole;
}): Promise<DetailPageSuiteProject | null> {
  const { normalizeDetailPageSuiteReferenceForStorage } = await import(
    "./ref-upload-normalize"
  );
  const stored = await normalizeDetailPageSuiteReferenceForStorage(opts.buf);
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: stored.ext,
    buf: stored.buf,
    contentType: stored.contentType,
  });
  const project = await getDetailPageSuiteReplicaProject(opts.userId, opts.projectId);
  if (!project) return null;
  const role = opts.role;
  const sameRole = project.references.filter((r) => r.role === role);
  const limit = REPLICA_ROLE_LIMITS[role];
  const newRef: DetailPageSuiteReference = {
    id: randomUUID(),
    label:
      opts.label?.trim() ||
      (role === "reference_suite"
        ? "参考详情长图"
        : role === "model"
          ? `模特图 ${sameRole.length + 1}`
          : `产品图 ${sameRole.length + 1}`),
    role,
    ossUrl,
  };
  let refs: DetailPageSuiteReference[];
  if (role === "reference_suite") {
    refs = [...project.references.filter((r) => r.role !== "reference_suite"), newRef];
  } else {
    refs = [
      ...project.references.filter((r) => r.role !== role),
      ...[...sameRole, newRef].slice(-limit),
    ];
  }
  return updateDetailPageSuiteReplicaProject(opts.userId, opts.projectId, { references: refs });
}

export async function listDetailPageSuiteHitProjects(
  userId: string,
): Promise<DetailPageSuiteProject[]> {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listDetailPageSuiteHitSummaries(userId: string) {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, suite: true },
  });
  return rows.map((row) => {
    const refs = sanitizeReferences(row.references);
    const suite = parseSuite(row.suite);
    const thumb =
      suite.modules.flatMap((m) => m.slots).find((s) => s.imageUrl)?.imageUrl ??
      refs.find((r) => r.role === "product")?.ossUrl ??
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

export async function createDetailPageSuiteHitProject(
  userId: string,
  opts?: { title?: string },
): Promise<DetailPageSuiteProject> {
  const row = await prisma.ecomDetailPageSuiteProject.create({
    data: {
      userId,
      module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE,
      title: opts?.title?.trim().slice(0, 120) || "爆款详情页套图",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      suite: buildInitialHitSuite() as unknown as Prisma.InputJsonValue,
      meta: {
        phase: "prompts",
        hitStatus: "idle",
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getDetailPageSuiteHitProject(
  userId: string,
  id: string,
): Promise<DetailPageSuiteProject | null> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE },
  });
  if (!row) return null;
  return loadDetailPageSuiteProjectNormalized(row);
}

export async function updateDetailPageSuiteHitProject(
  userId: string,
  id: string,
  patch: Parameters<typeof updateDetailPageSuiteProject>[2],
): Promise<DetailPageSuiteProject | null> {
  const existing = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE },
  });
  if (!existing) return null;
  const existingProject = rowToDto(existing);
  const normalizedPatch =
    patch.suite !== undefined
      ? prepareDetailPageSuitePatch(existingProject, {
          suite: patch.suite,
          meta: patch.meta !== undefined ? patch.meta : existingProject.meta,
        })
      : null;
  const row = await prisma.ecomDetailPageSuiteProject.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.brief !== undefined ? { brief: patch.brief as Prisma.InputJsonValue } : {}),
      ...(patch.settings !== undefined
        ? { settings: patch.settings as Prisma.InputJsonValue }
        : {}),
      ...(patch.references !== undefined
        ? { references: patch.references as Prisma.InputJsonValue }
        : {}),
      ...(patch.chatHistory !== undefined
        ? { chatHistory: patch.chatHistory as Prisma.InputJsonValue }
        : {}),
      ...(normalizedPatch?.suite !== undefined
        ? { suite: normalizedPatch.suite as Prisma.InputJsonValue }
        : patch.suite !== undefined
          ? { suite: patch.suite as Prisma.InputJsonValue }
          : {}),
      ...(normalizedPatch?.meta !== undefined
        ? { meta: normalizedPatch.meta as Prisma.InputJsonValue }
        : patch.meta !== undefined
          ? { meta: patch.meta as Prisma.InputJsonValue }
          : {}),
    },
  });
  return rowToDto(row);
}

export async function deleteDetailPageSuiteHitProject(
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_DETAIL_PAGE_SUITE_HIT_MODULE },
  });
  if (!row) return false;
  await prisma.ecomDetailPageSuiteProject.delete({ where: { id } });
  return true;
}

export async function uploadDetailPageSuiteHitReference(opts: {
  userId: string;
  projectId: string;
  buf: Buffer;
  contentType: string;
  label?: string;
  role: DetailPageSuiteReferenceRole;
}): Promise<DetailPageSuiteProject | null> {
  const { normalizeDetailPageSuiteReferenceForStorage } = await import(
    "./ref-upload-normalize"
  );
  const stored = await normalizeDetailPageSuiteReferenceForStorage(opts.buf);
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext: stored.ext,
    buf: stored.buf,
    contentType: stored.contentType,
  });
  const project = await getDetailPageSuiteHitProject(opts.userId, opts.projectId);
  if (!project) return null;
  const role = opts.role;
  const sameRole = project.references.filter((r) => r.role === role);
  const limit = REPLICA_ROLE_LIMITS[role];
  const newRef: DetailPageSuiteReference = {
    id: randomUUID(),
    label:
      opts.label?.trim() ||
      (role === "reference_suite"
        ? "竞品详情长截图"
        : role === "model"
          ? `模特图 ${sameRole.length + 1}`
          : `新品产品图 ${sameRole.length + 1}`),
    role,
    ossUrl,
  };
  let refs: DetailPageSuiteReference[];
  if (role === "reference_suite") {
    refs = [...project.references.filter((r) => r.role !== "reference_suite"), newRef];
  } else {
    refs = [
      ...project.references.filter((r) => r.role !== role),
      ...[...sameRole, newRef].slice(-limit),
    ];
  }
  return updateDetailPageSuiteHitProject(opts.userId, opts.projectId, { references: refs });
}
