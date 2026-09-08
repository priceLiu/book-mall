import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { generateVtonModelImage } from "@/lib/ecom/ecom-vton/model-generate";
import { expandVtonModelFullBody } from "@/lib/ecom/ecom-vton/model-full-body";
import {
  buildCartesianLookDrafts,
  importVtonLockedLooksFromMeta,
  lockVtonTryonResults,
  lockVtonUploadAsLook,
  patchVtonGarmentPool,
  patchVtonLookDrafts,
  runVtonProjectBatchTryon,
  setVtonDefaultLockedLook,
  unlockVtonLockedLook,
} from "@/lib/ecom/ecom-vton-project-mutations";
import {
  emptyVtonProjectMeta,
  resolveDefaultLockedLookUrl,
  sanitizeVtonProjectMeta,
} from "@/lib/ecom/ecom-vton/meta";
import type { VtonGarmentItem, VtonLookSpec, VtonProjectMeta } from "@/lib/ecom/ecom-vton/types";
import {
  ECOM_MODEL_TRYON_MODULE,
  ECOM_MODEL_TRYON_TOOL_KEY,
  MODEL_TRYON_V1_TEMPLATE_ID,
  type ModelTryonProjectDto,
  type ModelTryonSettings,
} from "@/lib/ecom/ecom-model-tryon-types";
import {
  inferKindFromOssUrl,
  resolveMediaDecomposeUpload,
} from "@/lib/ecom/ecom-media-decompose-media";
import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import type { VtonGarmentMode, VtonRefMode } from "@/lib/ecom/ecom-vton/types";

const REF_IMAGE_KEYS = [
  "model",
  "clothing",
  "topGarment",
  "bottomGarment",
  "dressedImage",
] as const;

type RefImageKey = (typeof REF_IMAGE_KEYS)[number];

function sanitizeOutfitRefMode(raw: unknown): VtonRefMode {
  return raw === "already_dressed" ? "already_dressed" : "need_tryon";
}

function sanitizeGarmentMode(raw: unknown): VtonGarmentMode {
  return raw === "one_piece" ? "one_piece" : "two_piece";
}

function sanitizeSettings(raw: unknown): ModelTryonSettings {
  if (!raw || typeof raw !== "object") {
    return { outfitRefMode: "need_tryon", garmentMode: "two_piece" };
  }
  const o = raw as Record<string, unknown>;
  return {
    outfitRefMode: sanitizeOutfitRefMode(o.outfitRefMode),
    garmentMode: sanitizeGarmentMode(o.garmentMode),
    imageModelKey:
      typeof o.imageModelKey === "string" && o.imageModelKey.trim()
        ? o.imageModelKey.trim()
        : undefined,
    fusionModelKey:
      typeof o.fusionModelKey === "string" && o.fusionModelKey.trim()
        ? o.fusionModelKey.trim()
        : undefined,
  };
}

function sanitizeRefImageEntry(
  v: unknown,
): WorkflowRefs[RefImageKey] | undefined {
  if (!v || typeof v !== "object") return undefined;
  const r = v as Record<string, unknown>;
  if (typeof r.ossUrl !== "string" || !r.ossUrl.trim()) return undefined;
  return {
    ossUrl: r.ossUrl.trim(),
    label: typeof r.label === "string" ? r.label : undefined,
    source:
      typeof r.source === "string"
        ? (r.source as NonNullable<WorkflowRefs[RefImageKey]>["source"])
        : undefined,
  };
}

function sanitizeRefs(raw: unknown): WorkflowRefs {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: WorkflowRefs = {};
  for (const key of REF_IMAGE_KEYS) {
    const parsed = sanitizeRefImageEntry(o[key]);
    if (parsed) out[key] = parsed;
  }
  return out;
}

function sanitizeMeta(raw: unknown): VtonProjectMeta | null {
  if (!raw || typeof raw !== "object") return emptyVtonProjectMeta();
  return sanitizeVtonProjectMeta(raw);
}

function rowToDto(row: {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: unknown;
  references: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ModelTryonProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    templateId: row.templateId,
    status: row.status,
    phase: row.phase,
    settings: sanitizeSettings(row.settings),
    references: sanitizeRefs(row.references),
    meta: sanitizeMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedRow(userId: string, projectId: string) {
  return prisma.ecomVideoWorkflowProject.findFirst({
    where: { userId, id: projectId, module: ECOM_MODEL_TRYON_MODULE },
  });
}

export async function listEcomModelTryonProjects(
  userId: string,
): Promise<ModelTryonProjectDto[]> {
  const rows = await prisma.ecomVideoWorkflowProject.findMany({
    where: { userId, module: ECOM_MODEL_TRYON_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function createEcomModelTryonProject(
  userId: string,
  opts?: { title?: string },
): Promise<ModelTryonProjectDto> {
  const row = await prisma.ecomVideoWorkflowProject.create({
    data: {
      userId,
      module: ECOM_MODEL_TRYON_MODULE,
      templateId: MODEL_TRYON_V1_TEMPLATE_ID,
      title: opts?.title?.trim() || "模特试衣",
      phase: "bind_refs",
      settings: {
        outfitRefMode: "need_tryon",
        garmentMode: "two_piece",
      } as Prisma.InputJsonValue,
      references: Prisma.JsonNull,
      structured: Prisma.JsonNull,
      sceneList: Prisma.JsonNull,
      composeResult: Prisma.JsonNull,
      meta: emptyVtonProjectMeta() as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomModelTryonProject(
  userId: string,
  projectId: string,
): Promise<ModelTryonProjectDto | null> {
  const row = await getOwnedRow(userId, projectId);
  return row ? rowToDto(row) : null;
}

export async function updateEcomModelTryonProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    settings: ModelTryonSettings;
    references: WorkflowRefs;
    meta: ModelTryonProjectDto["meta"];
  }>,
): Promise<ModelTryonProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomVideoWorkflowProjectUpdateInput = {};
  if (typeof patch.title === "string") data.title = patch.title.trim() || "模特试衣";
  if (patch.settings) {
    data.settings = {
      ...sanitizeSettings(existing.settings),
      ...patch.settings,
    } as Prisma.InputJsonValue;
  }
  if (patch.references) data.references = patch.references as Prisma.InputJsonValue;
  if (patch.meta !== undefined) {
    data.meta = sanitizeVtonProjectMeta({
      ...(sanitizeMeta(existing.meta) ?? {}),
      ...patch.meta,
    }) as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomVideoWorkflowProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

export async function attachEcomModelTryonRefs(
  userId: string,
  projectId: string,
  patch: Partial<WorkflowRefs>,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const refs: WorkflowRefs = {
    ...project.references,
    ...patch,
  };
  delete refs.dressedImage;

  return updateEcomModelTryonProject(userId, projectId, {
    references: refs,
    meta: {
      ...(project.meta ?? {}),
      tryonProgress: null,
    },
  });
}

export async function uploadEcomModelTryonRefImage(
  userId: string,
  projectId: string,
  role: "model" | "clothing" | "topGarment" | "bottomGarment",
  file: File,
): Promise<ModelTryonProjectDto> {
  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");

  const labelByRole: Record<typeof role, string> = {
    model: "模特图",
    clothing: "服装图",
    topGarment: "上装",
    bottomGarment: "下装",
  };

  return attachEcomModelTryonRefs(userId, projectId, {
    [role]: {
      ossUrl: uploaded.ossUrl,
      source: "upload",
      label: labelByRole[role],
    },
  });
}

export async function generateEcomModelTryonModel(
  userId: string,
  projectId: string,
  opts: { prompt: string; modelKey?: string },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const ossUrl = await generateVtonModelImage({
    userId,
    prompt: opts.prompt,
    modelKey: opts.modelKey ?? project.settings.imageModelKey,
    toolKeySuffix: "model-tryon__model-generate",
  });

  const refs = sanitizeRefs(project.references);
  delete refs.dressedImage;

  return updateEcomModelTryonProject(userId, projectId, {
    references: {
      ...refs,
      model: { ossUrl, source: "ai-generate", label: "AI 生模特" },
    },
    meta: { ...(project.meta ?? {}), tryonProgress: null },
  });
}

export async function expandEcomModelTryonModelFullBody(
  userId: string,
  projectId: string,
  opts?: { prompt?: string; modelKey?: string },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const portraitUrl = project.references.model?.ossUrl?.trim();
  if (!portraitUrl) throw new Error("请先上传或选择模特图");

  const ossUrl = await expandVtonModelFullBody({
    userId,
    portraitUrl,
    prompt: opts?.prompt,
    modelKey: opts?.modelKey ?? project.settings.fusionModelKey,
    toolKeySuffix: "model-tryon__expand-full-body",
  });

  const refs = sanitizeRefs(project.references);
  delete refs.dressedImage;

  return updateEcomModelTryonProject(userId, projectId, {
    references: {
      ...refs,
      model: { ossUrl, source: "ai-generate", label: "全身模特" },
    },
    meta: { ...(project.meta ?? {}), tryonProgress: null },
  });
}

async function persistModelTryonMeta(
  userId: string,
  projectId: string,
  meta: VtonProjectMeta,
  references?: WorkflowRefs,
): Promise<ModelTryonProjectDto> {
  return updateEcomModelTryonProject(userId, projectId, {
    meta,
    ...(references ? { references } : {}),
  });
}

export async function patchEcomModelTryonGarments(
  userId: string,
  projectId: string,
  opts: {
    add?: Array<Omit<VtonGarmentItem, "id"> & { id?: string }>;
    removeIds?: string[];
  },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const meta = patchVtonGarmentPool(project.meta, opts);
  return updateEcomModelTryonProject(userId, projectId, { meta });
}

export async function uploadEcomModelTryonGarment(
  userId: string,
  projectId: string,
  kind: VtonGarmentItem["kind"],
  file: File,
): Promise<ModelTryonProjectDto> {
  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");
  return patchEcomModelTryonGarments(userId, projectId, {
    add: [
      {
        kind,
        ossUrl: uploaded.ossUrl,
        source: "upload",
        label: file.name.replace(/\.[^.]+$/, "") || VTON_GARMENT_KIND_LABELS[kind],
      },
    ],
  });
}

const VTON_GARMENT_KIND_LABELS: Record<VtonGarmentItem["kind"], string> = {
  top: "上装",
  bottom: "下装",
  one_piece: "连体/裙",
  full_set: "套装",
};

export async function patchEcomModelTryonLooks(
  userId: string,
  projectId: string,
  looks: VtonLookSpec[],
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const meta = patchVtonLookDrafts(project.meta, looks);
  return updateEcomModelTryonProject(userId, projectId, { meta });
}

export async function buildEcomModelTryonCartesianLooks(
  userId: string,
  projectId: string,
  opts: { topIds: string[]; bottomIds: string[] },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const meta = buildCartesianLookDrafts({
    metaRaw: project.meta,
    topIds: opts.topIds,
    bottomIds: opts.bottomIds,
  });
  return updateEcomModelTryonProject(userId, projectId, { meta });
}

export async function runEcomModelTryonBatch(
  userId: string,
  projectId: string,
  opts?: { looks?: VtonLookSpec[] },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const modelUrl = project.references.model?.ossUrl?.trim();
  if (!modelUrl) throw new Error("请先上传或选择模特全身照");

  const meta = await runVtonProjectBatchTryon({
    userId,
    projectId,
    consumerToolKey: ECOM_MODEL_TRYON_TOOL_KEY,
    modelUrl,
    metaRaw: project.meta,
    looks: opts?.looks,
    persistMeta: async (m) => {
      await persistModelTryonMeta(userId, projectId, m);
    },
  });

  const latest = await getEcomModelTryonProject(userId, projectId);
  if (!latest) throw new Error("项目不存在");

  const best = meta.tryonBatch?.results.find((r) => r.status === "success" && r.ossUrl);
  const refs = best
    ? {
        ...latest.references,
        dressedImage: {
          ossUrl: best.ossUrl!,
          source: "aitryon-plus" as const,
          label: "AI 试衣预览",
        },
      }
    : latest.references;

  return updateEcomModelTryonProject(userId, projectId, { meta, references: refs });
}

export async function lockEcomModelTryonResults(
  userId: string,
  projectId: string,
  resultIds: string[],
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const { meta, references } = lockVtonTryonResults(project.meta, resultIds, project.references);
  return updateEcomModelTryonProject(userId, projectId, { meta, references });
}

export async function unlockEcomModelTryonLockedLook(
  userId: string,
  projectId: string,
  lockedLookId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const { meta, references } = unlockVtonLockedLook(project.meta, lockedLookId, project.references);
  return updateEcomModelTryonProject(userId, projectId, { meta, references });
}

export async function setEcomModelTryonDefaultLockedLook(
  userId: string,
  projectId: string,
  lockedLookId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const { meta, references } = setVtonDefaultLockedLook(
    project.meta,
    lockedLookId,
    project.references,
  );
  return updateEcomModelTryonProject(userId, projectId, { meta, references });
}

/** @deprecated 使用 runEcomModelTryonBatch */
export async function runEcomModelTryonPreview(
  userId: string,
  projectId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const looks = project.meta?.lookDrafts ?? [];
  if (looks.length !== 1) {
    throw new Error("请使用批量试衣；单套试衣请只保留 1 条搭配");
  }
  return runEcomModelTryonBatch(userId, projectId, { looks });
}

export async function saveEcomModelTryonResultToAssets(
  userId: string,
  projectId: string,
  opts?: { title?: string },
): Promise<{ assetId: string }> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const url =
    resolveDefaultLockedLookUrl(sanitizeVtonProjectMeta(project.meta)) ??
    project.references.dressedImage?.ossUrl?.trim();
  if (!url) throw new Error("请先完成 AI 试衣并锁定参考");

  const kind = inferKindFromOssUrl(url);
  const title =
    opts?.title?.trim() ||
    project.references.dressedImage?.label?.trim() ||
    project.title?.trim() ||
    "模特试衣成片";

  const asset = await prisma.ecomAsset.create({
    data: {
      userId,
      module: ECOM_MODEL_TRYON_MODULE,
      kind: kind === "video" ? "video" : "image",
      title: title.slice(0, 120),
      ossUrl: url,
      thumbnailUrl: url,
      meta: {
        projectId,
        source: project.references.dressedImage?.source ?? "aitryon-plus",
      },
    },
  });

  return { assetId: asset.id };
}
