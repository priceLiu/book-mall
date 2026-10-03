import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildPosterAutoPlan } from "@/lib/ecom/ecom-poster-auto-plan";
import { composePosterArtifact } from "@/lib/ecom/ecom-poster-compose";
import { generatePosterImages } from "@/lib/ecom/ecom-poster-generate";
import {
  ECOM_POSTER_MODULE,
  defaultPosterPlan,
  parsePosterMeta,
  parsePosterPlan,
  parsePosterSettings,
  sanitizePosterReferences,
  type PosterEasyPath,
  type PosterPlan,
  type PosterReference,
} from "@/lib/ecom/ecom-poster-types";
import { prisma } from "@/lib/prisma";

export type EcomPosterProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: ReturnType<typeof parsePosterSettings>;
  references: PosterReference[];
  plan: PosterPlan;
  meta: ReturnType<typeof parsePosterMeta>;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: unknown;
  settings: unknown;
  references: unknown;
  plan: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: Row): EcomPosterProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: parsePosterSettings(row.settings),
    references: sanitizePosterReferences(row.references),
    plan: parsePosterPlan(row.plan),
    meta: parsePosterMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEcomPosterProjects(userId: string) {
  const rows = await prisma.ecomPosterProject.findMany({
    where: { userId, module: ECOM_POSTER_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function createEcomPosterProject(userId: string, opts?: { title?: string }) {
  const row = await prisma.ecomPosterProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "营销海报",
      references: [] as Prisma.InputJsonValue,
      plan: defaultPosterPlan() as unknown as Prisma.InputJsonValue,
      settings: {} as Prisma.InputJsonValue,
      meta: { workflow: { lastTab: "easy" } } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomPosterProject(userId: string, projectId: string) {
  const row = await prisma.ecomPosterProject.findFirst({
    where: { id: projectId, userId, module: ECOM_POSTER_MODULE },
  });
  return row ? rowToDto(row) : null;
}

export async function updateEcomPosterProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    brief?: Record<string, unknown> | null;
    settings?: Record<string, unknown>;
    references?: PosterReference[];
    plan?: PosterPlan;
    meta?: Record<string, unknown>;
    status?: string;
  },
) {
  const existing = await getEcomPosterProject(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const row = await prisma.ecomPosterProject.update({
    where: { id: projectId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title?.slice(0, 120) ?? null } : {}),
      ...(patch.brief !== undefined ? { brief: patch.brief as Prisma.InputJsonValue } : {}),
      ...(patch.settings !== undefined
        ? { settings: patch.settings as Prisma.InputJsonValue }
        : {}),
      ...(patch.references !== undefined
        ? { references: patch.references as unknown as Prisma.InputJsonValue }
        : {}),
      ...(patch.plan !== undefined
        ? { plan: patch.plan as unknown as Prisma.InputJsonValue }
        : {}),
      ...(patch.meta !== undefined ? { meta: patch.meta as Prisma.InputJsonValue } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
    },
  });
  return rowToDto(row);
}

export async function uploadPosterRef(userId: string, projectId: string, buf: Buffer, mime: string) {
  const project = await getEcomPosterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const ext = mime.includes("png") ? "png" : "jpg";
  const url = await uploadCanvasUserBuffer({
    userId,
    buf,
    contentType: mime,
    ext,
  });
  return url;
}

export async function runPosterAutoPlan(
  userId: string,
  projectId: string,
  opts: {
    easyPath: PosterEasyPath;
    festivalId?: string;
    oneLineBrief?: string;
  },
) {
  const project = await getEcomPosterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const autoPlan = buildPosterAutoPlan({
    easyPath: opts.easyPath,
    festivalId: opts.festivalId ?? project.plan.festivalId,
    oneLineBrief: opts.oneLineBrief,
    posterStyleId: project.plan.posterStyleId,
    aspectRatio: project.plan.aspectRatio,
    references: project.references,
    useBrandRefs: project.plan.useBrandRefs,
  });
  const plan: PosterPlan = {
    ...project.plan,
    easyPath: opts.easyPath,
    festivalId: opts.festivalId ?? project.plan.festivalId,
    autoPlan,
  };
  return updateEcomPosterProject(userId, projectId, { plan });
}

export async function runPosterGenerate(userId: string, projectId: string, count?: number) {
  const project = await getEcomPosterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const { artifacts, urls } = await generatePosterImages({
    userId,
    projectId,
    plan: project.plan,
    settings: project.settings,
    references: project.references,
    slotCopy: project.plan.autoPlan?.slotCopy,
    imagePrompt: project.plan.autoPlan?.imagePrompt,
    count,
  });
  const plan: PosterPlan = {
    ...project.plan,
    artifacts: [...project.plan.artifacts, ...artifacts],
    activeArtifactIndex: project.plan.artifacts.length + artifacts.length - 1,
  };
  const updated = await updateEcomPosterProject(userId, projectId, {
    plan,
    status: "ready",
  });
  return { project: updated, urls };
}

export async function runPosterCompose(
  userId: string,
  projectId: string,
  artifactIndex: number,
  artifact: import("@private/ecom-copy-overlay").EcomCopyImageArtifact,
  slotCopy?: string,
) {
  const project = await getEcomPosterProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const { url, artifact: next, assetId } = await composePosterArtifact({
    userId,
    projectId,
    artifact,
    slotCopy,
    title: project.title ?? undefined,
  });
  const artifacts = [...project.plan.artifacts];
  if (artifactIndex >= 0 && artifactIndex < artifacts.length) {
    artifacts[artifactIndex] = next;
  } else {
    artifacts.push(next);
  }
  const plan: PosterPlan = {
    ...project.plan,
    artifacts,
    activeArtifactIndex: artifactIndex >= 0 ? artifactIndex : artifacts.length - 1,
  };
  const updated = await updateEcomPosterProject(userId, projectId, { plan });
  return { project: updated, url, assetId };
}

export { POSTER_FESTIVAL_PACKS } from "@/lib/ecom/ecom-poster-festival-packs";
