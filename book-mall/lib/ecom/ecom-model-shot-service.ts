import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  assembleModelShotPrompt,
  rebuildModelShotItemPrompt,
  resolveModelShotPropText,
  resolveModelShotSceneText,
} from "@/lib/ecom/model-shot/prompt-assembler";
import { pickModelShotPoses, posesToPromptTexts } from "@/lib/ecom/model-shot/pose-picker";
import { readPoseLibraryCatalogLive } from "@/lib/ecom/ecom-pose-library-service";
import { getPropLibraryEntry } from "@/lib/ecom/ecom-prop-library-service";
import { getSceneLibraryEntry } from "@/lib/ecom/ecom-scene-library-service";
import {
  ECOM_MODEL_SHOT_MODULE,
  MODEL_SHOT_POSE_COUNT_DEFAULT,
  parseModelShotPlan,
  sanitizeModelShotChatMessages,
  sanitizeModelShotReferences,
  type ModelShotBrief,
  type ModelShotMeta,
  type ModelShotPlan,
  type ModelShotPoseItem,
  type ModelShotProject,
  type ModelShotSettings,
} from "@/lib/ecom/ecom-model-shot-types";
import { reconcileModelShotPendingOnRead } from "@/lib/ecom/ecom-model-shot-pending-images";
import { prisma } from "@/lib/prisma";

export type EcomModelShotProjectDto = ModelShotProject;

type Row = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: unknown;
  settings: unknown;
  references: unknown;
  chatHistory: unknown;
  plan: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: Row): EcomModelShotProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as ModelShotBrief | null) ?? null,
    settings: (row.settings as ModelShotSettings) ?? {},
    references: sanitizeModelShotReferences(row.references),
    chatHistory: sanitizeModelShotChatMessages(row.chatHistory),
    plan: parseModelShotPlan(row.plan),
    meta: (row.meta as ModelShotMeta | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEcomModelShotProjects(userId: string): Promise<EcomModelShotProjectDto[]> {
  const rows = await prisma.ecomModelShotProject.findMany({
    where: { userId, module: ECOM_MODEL_SHOT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listEcomModelShotProjectSummaries(userId: string) {
  const rows = await prisma.ecomModelShotProject.findMany({
    where: { userId, module: ECOM_MODEL_SHOT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, plan: true },
  });
  return rows.map((row) => {
    const plan = parseModelShotPlan(row.plan);
    const thumb =
      plan.items.find((i) => i.imageUrl)?.imageUrl ??
      sanitizeModelShotReferences(row.references).find((r) => r.role === "garment")?.ossUrl ??
      null;
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      thumbnailUrl: thumb,
    };
  });
}

export async function createEcomModelShotProject(
  userId: string,
  opts?: { title?: string },
): Promise<EcomModelShotProjectDto> {
  const row = await prisma.ecomModelShotProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "服装模特图",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      plan: { status: "draft", items: [] } as Prisma.InputJsonValue,
      meta: { phase: "garment" } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomModelShotProject(
  userId: string,
  id: string,
): Promise<EcomModelShotProjectDto | null> {
  const row = await prisma.ecomModelShotProject.findFirst({
    where: { id, userId, module: ECOM_MODEL_SHOT_MODULE },
  });
  if (!row) return null;
  const dto = rowToDto(row);
  const cleared = await reconcileModelShotPendingOnRead({
    projectId: id,
    meta: dto.meta,
    planItems: dto.plan.items,
  });
  if (cleared.length === 0) return dto;
  const fresh = await prisma.ecomModelShotProject.findFirst({
    where: { id, userId, module: ECOM_MODEL_SHOT_MODULE },
  });
  return fresh ? rowToDto(fresh) : dto;
}

export async function updateEcomModelShotProject(
  userId: string,
  id: string,
  patch: Partial<{
    title: string;
    status: string;
    brief: ModelShotBrief | null;
    settings: ModelShotSettings;
    references: ModelShotProject["references"];
    chatHistory: ModelShotProject["chatHistory"];
    plan: ModelShotPlan;
    meta: ModelShotMeta | null;
  }>,
): Promise<EcomModelShotProjectDto | null> {
  const existing = await prisma.ecomModelShotProject.findFirst({
    where: { id, userId, module: ECOM_MODEL_SHOT_MODULE },
  });
  if (!existing) return null;

  const row = await prisma.ecomModelShotProject.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.brief !== undefined ? { brief: patch.brief as Prisma.InputJsonValue } : {}),
      ...(patch.settings !== undefined ? { settings: patch.settings as Prisma.InputJsonValue } : {}),
      ...(patch.references !== undefined
        ? { references: patch.references as Prisma.InputJsonValue }
        : {}),
      ...(patch.chatHistory !== undefined
        ? { chatHistory: patch.chatHistory as Prisma.InputJsonValue }
        : {}),
      ...(patch.plan !== undefined ? { plan: patch.plan as Prisma.InputJsonValue } : {}),
      ...(patch.meta !== undefined ? { meta: patch.meta as Prisma.InputJsonValue } : {}),
    },
  });
  return rowToDto(row);
}

export async function deleteEcomModelShotProject(userId: string, id: string): Promise<boolean> {
  const row = await prisma.ecomModelShotProject.findFirst({
    where: { id, userId, module: ECOM_MODEL_SHOT_MODULE },
  });
  if (!row) return false;
  await prisma.ecomModelShotProject.delete({ where: { id } });
  return true;
}

export async function generateModelShotPosePlan(
  userId: string,
  projectId: string,
): Promise<EcomModelShotProjectDto | null> {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) return null;

  const catalog = await readPoseLibraryCatalogLive();
  const poseCount = project.brief?.poseCount ?? MODEL_SHOT_POSE_COUNT_DEFAULT;
  const styles = project.brief?.styles ?? ["优雅"];
  const sceneRef = project.references.find((r) => r.role === "scene");
  const scene =
    sceneRef?.catalogId && sceneRef.source !== "none"
      ? await getSceneLibraryEntry(sceneRef.catalogId)
      : null;

  const picked = pickModelShotPoses({
    pool: catalog.poses.filter((p) => (p.scope ?? "platform") === "platform"),
    styles,
    count: poseCount,
    scene,
  });
  const descriptions = posesToPromptTexts({ poses: picked, styles });
  const sceneText = resolveModelShotSceneText(project.references, project.brief);
  const sceneCatalogId =
    sceneRef?.catalogId && sceneRef.source !== "none" ? sceneRef.catalogId : undefined;

  const items: ModelShotPoseItem[] = picked.map((pose, i) => {
    const poseDescription = descriptions[i]!;
    const propText = "";
    return {
      index: i + 1,
      poseId: pose.id,
      category: pose.category,
      title: pose.title,
      poseDescription,
      sceneText,
      sceneCatalogId,
      propText,
      propCatalogId: undefined,
      prompt: assembleModelShotPrompt({
        poseDescription,
        brief: project.brief,
        references: project.references,
        sceneText,
        propText,
      }),
      status: "pending",
    };
  });

  return updateEcomModelShotProject(userId, projectId, {
    plan: { status: "ready", items },
    meta: { ...(project.meta ?? {}), phase: "confirm" },
    status: "draft",
  });
}

export async function uploadModelShotReference(opts: {
  userId: string;
  projectId: string;
  role: "garment" | "model" | "scene" | "prop";
  buf: Buffer;
  contentType: string;
  label?: string;
  source?: string;
  catalogId?: string;
  name?: string;
  description?: string;
}): Promise<EcomModelShotProjectDto | null> {
  const ext = opts.contentType.includes("png") ? "png" : "jpg";
  const ossUrl = await uploadCanvasUserBuffer({
    userId: opts.userId,
    ext,
    buf: opts.buf,
    contentType: opts.contentType,
  });

  const project = await getEcomModelShotProject(opts.userId, opts.projectId);
  if (!project) return null;

  const refs = project.references.filter((r) => r.role !== opts.role);
  refs.push({
    id: randomUUID(),
    role: opts.role,
    source: opts.source ?? "upload",
    ossUrl,
    catalogId: opts.catalogId,
    name: opts.name,
    description: opts.description,
    label: opts.label ?? opts.role,
  });

  return updateEcomModelShotProject(opts.userId, opts.projectId, {
    references: refs,
  });
}

export async function attachModelShotReferenceFromAssets(
  userId: string,
  projectId: string,
  role: "garment" | "model" | "scene" | "prop",
  assetIds: string[],
): Promise<EcomModelShotProjectDto | null> {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) return null;

  const id = assetIds.find((x) => x.trim());
  if (!id) throw new Error("请至少选择一张资产图");

  const asset = await prisma.ecomAsset.findFirst({
    where: { userId, id, kind: "image" },
    select: { id: true, title: true, ossUrl: true },
  });
  if (!asset?.ossUrl) throw new Error("找不到所选资产");

  const refs = project.references.filter((r) => r.role !== role);
  refs.push({
    id: randomUUID(),
    role,
    source: "asset",
    ossUrl: asset.ossUrl,
    label: asset.title ?? role,
  });

  return updateEcomModelShotProject(userId, projectId, { references: refs });
}

export async function removeModelShotReference(
  userId: string,
  projectId: string,
  role: "garment" | "model" | "scene" | "prop",
): Promise<EcomModelShotProjectDto | null> {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) return null;
  const refs = project.references.filter((r) => r.role !== role);
  return updateEcomModelShotProject(userId, projectId, { references: refs });
}

export async function attachModelShotTextReference(
  userId: string,
  projectId: string,
  role: "model" | "scene" | "prop",
  description: string,
): Promise<EcomModelShotProjectDto | null> {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) return null;
  const refs = project.references.filter((r) => r.role !== role);
  refs.push({
    id: randomUUID(),
    role,
    source: "text",
    description: description.trim(),
    label: role,
  });
  return updateEcomModelShotProject(userId, projectId, { references: refs });
}

export async function attachModelShotModelFromLibrary(
  userId: string,
  projectId: string,
  entry: { id: string; name: string; ossUrl: string },
): Promise<EcomModelShotProjectDto | null> {
  const project = await getEcomModelShotProject(userId, projectId);
  if (!project) return null;
  const refs = project.references.filter((r) => r.role !== "model");
  refs.push({
    id: randomUUID(),
    role: "model",
    source: "model-library",
    catalogId: entry.id,
    name: entry.name,
    ossUrl: entry.ossUrl,
    label: entry.name,
  });
  return updateEcomModelShotProject(userId, projectId, { references: refs });
}
