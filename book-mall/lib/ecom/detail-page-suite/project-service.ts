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
import { buildInitialAplusSuite } from "@/lib/ecom/detail-page-aplus/aplus-suite-init";
import { buildInitialHitSuite } from "@/lib/ecom/detail-page-suite-hit/hit-materialize";
import {
  buildInitialReplicaSuite,
  healIdleReplicaProjectBeforeDecompose,
} from "@/lib/ecom/detail-page-suite-replica/replica-materialize";

import {
  ECOM_AI_DETAIL_PAGE_MODULE,
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
      title: opts?.title?.trim().slice(0, 120) || "服装详情套图（模板）",
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
      title: opts?.title?.trim().slice(0, 120) || "参考详情 → 标准套图",
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
      title: opts?.title?.trim().slice(0, 120) || "学竞品结构 · 原创详情",
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

export async function listDetailPageSuiteAplusProjects(
  userId: string,
): Promise<DetailPageSuiteProject[]> {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_AI_DETAIL_PAGE_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listDetailPageSuiteAplusSummaries(userId: string) {
  const rows = await prisma.ecomDetailPageSuiteProject.findMany({
    where: { userId, module: ECOM_AI_DETAIL_PAGE_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, suite: true },
  });
  return rows.map((row) => {
    const refs = sanitizeReferences(row.references);
    const suite = parseSuite(row.suite);
    const thumb =
      suite.modules
        .flatMap((m) => m.slots)
        .map((s) => {
          if (s.imageUrl?.trim()) return s.imageUrl;
          const hist = s.imageHistory;
          if (!hist?.length) return null;
          const last = hist[hist.length - 1];
          return typeof last === "string" ? last : (last?.url ?? null);
        })
        .find(Boolean) ??
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

export async function createDetailPageSuiteAplusProject(
  userId: string,
  opts?: { title?: string },
): Promise<DetailPageSuiteProject> {
  const row = await prisma.ecomDetailPageSuiteProject.create({
    data: {
      userId,
      module: ECOM_AI_DETAIL_PAGE_MODULE,
      title: opts?.title?.trim().slice(0, 120) || "A+ 详情模块出图",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      suite: buildInitialAplusSuite() as unknown as Prisma.InputJsonValue,
      meta: { phase: "product_ref" } as Prisma.InputJsonValue,
      settings: {
        platformCode: "amazon",
        outputLanguage: "英文",
      } as Prisma.InputJsonValue,
    },
  });
  return loadDetailPageSuiteProjectNormalized(row);
}

export async function getDetailPageSuiteAplusProject(
  userId: string,
  id: string,
): Promise<DetailPageSuiteProject | null> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_AI_DETAIL_PAGE_MODULE },
  });
  if (!row) return null;
  return loadDetailPageSuiteProjectNormalized(row);
}

export async function updateDetailPageSuiteAplusProject(
  userId: string,
  id: string,
  patch: Parameters<typeof updateDetailPageSuiteProject>[2],
): Promise<DetailPageSuiteProject | null> {
  const existing = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_AI_DETAIL_PAGE_MODULE },
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

export async function deleteDetailPageSuiteAplusProject(
  userId: string,
  id: string,
): Promise<boolean> {
  const row = await prisma.ecomDetailPageSuiteProject.findFirst({
    where: { id, userId, module: ECOM_AI_DETAIL_PAGE_MODULE },
  });
  if (!row) return false;
  await prisma.ecomDetailPageSuiteProject.delete({ where: { id } });
  return true;
}

export async function uploadDetailPageSuiteAplusReference(opts: {
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
  const project = await getDetailPageSuiteAplusProject(opts.userId, opts.projectId);
  if (!project) return null;
  const role = opts.role;
  const sameRole = project.references.filter((r) => r.role === role);
  const limit = REPLICA_ROLE_LIMITS[role];
  const newRef: DetailPageSuiteReference = {
    id: randomUUID(),
    label:
      opts.label?.trim() ||
      (role === "model"
        ? `模特图 ${sameRole.length + 1}`
        : `产品图 ${sameRole.length + 1}`),
    role,
    ossUrl,
  };
  const refs = [
    ...project.references.filter((r) => r.role !== role),
    ...[...sameRole, newRef].slice(-limit),
  ];
  return updateDetailPageSuiteAplusProject(opts.userId, opts.projectId, { references: refs });
}

const APLUS_SLOT_PROMPT_REF_MAX = 3;
const APLUS_PROMPT_PLANNER_MAX_CHARS = 120_000;

export async function appendAplusSlotPromptRef(opts: {
  userId: string;
  projectId: string;
  moduleId: string;
  slotId: string;
  buf: Buffer;
  contentType: string;
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
  const project = await getDetailPageSuiteAplusProject(opts.userId, opts.projectId);
  if (!project) return null;
  const { resolveModuleDisplaySlots } = await import("./module-slots");
  let found = false;
  const nextModules = project.suite.modules.map((mod) => {
    if (mod.module_id !== opts.moduleId) return mod;
    const display = resolveModuleDisplaySlots(mod);
    const hasSlot =
      mod.slots.some((s) => s.item_key === opts.slotId) ||
      display.some((s) => s.item_key === opts.slotId);
    if (!hasSlot) return mod;
    found = true;
    const nextSlots = mod.slots.map((s) =>
      s.item_key === opts.slotId
        ? {
            ...s,
            promptRefUrls: [...(s.promptRefUrls ?? []), ossUrl].slice(
              -APLUS_SLOT_PROMPT_REF_MAX,
            ),
          }
        : s,
    );
    if (!mod.slots.some((s) => s.item_key === opts.slotId)) {
      const fromDisplay = display.find((s) => s.item_key === opts.slotId);
      if (fromDisplay) {
        nextSlots.push({
          ...fromDisplay,
          promptRefUrls: [ossUrl],
        });
      }
    }
    return { ...mod, slots: nextSlots };
  });
  if (!found) return null;
  return updateDetailPageSuiteAplusProject(opts.userId, opts.projectId, {
    suite: { ...project.suite, modules: nextModules },
  });
}

export async function patchAplusPromptPlanner(opts: {
  userId: string;
  projectId: string;
  customSystemBody?: string;
  mode?: "default" | "custom";
  customSystemFileUrl?: string | null;
}): Promise<DetailPageSuiteProject | null> {
  const project = await getDetailPageSuiteAplusProject(opts.userId, opts.projectId);
  if (!project) return null;
  const prev = project.settings.aplusPromptPlanner ?? {};
  const customSystemBody =
    opts.customSystemBody !== undefined ? opts.customSystemBody : prev.customSystemBody ?? "";
  if (customSystemBody.length > APLUS_PROMPT_PLANNER_MAX_CHARS) {
    throw new Error(
      `策划 Prompt 正文过长（上限 ${APLUS_PROMPT_PLANNER_MAX_CHARS} 字）`,
    );
  }
  const mode = opts.mode ?? prev.mode ?? "default";
  const nextPlanner = {
    mode,
    ...(mode === "custom" && customSystemBody
      ? { customSystemBody }
      : {}),
    ...(opts.customSystemFileUrl !== undefined
      ? opts.customSystemFileUrl
        ? { customSystemFileUrl: opts.customSystemFileUrl }
        : {}
      : mode === "custom" && prev.customSystemFileUrl
        ? { customSystemFileUrl: prev.customSystemFileUrl }
        : {}),
    updatedAt: new Date().toISOString(),
  };
  return updateDetailPageSuiteAplusProject(opts.userId, opts.projectId, {
    settings: {
      ...project.settings,
      aplusPromptPlanner: nextPlanner,
    },
  });
}

export async function uploadAplusPromptPlannerFile(opts: {
  userId: string;
  projectId: string;
  buf: Buffer;
  fileName: string;
}): Promise<DetailPageSuiteProject | null> {
  const text = opts.buf.toString("utf8");
  const ext = opts.fileName.toLowerCase();
  if (!ext.endsWith(".md") && !ext.endsWith(".txt")) {
    throw new Error("仅支持 .md 或 .txt 文件");
  }
  return patchAplusPromptPlanner({
    userId: opts.userId,
    projectId: opts.projectId,
    customSystemBody: text,
    mode: "custom",
  });
}
