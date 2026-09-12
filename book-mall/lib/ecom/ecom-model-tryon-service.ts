import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { detectVtonModelImageBody } from "@/lib/ecom/ecom-vton/model-body-detect";
import {
  assertGenerationConfirmable,
  assertGenerationFullBodyForTryon,
  canConfirmModelGenerationByBody,
  prepareTryonModelGeneration,
  vtonGenerationBodyCheckFailed,
  vtonGenerationBodyCheckForAi,
  vtonGenerationBodyCheckFromDetect,
} from "@/lib/ecom/ecom-vton/model-generation-body-check";
import {
  applyFullSetGarmentUpload,
  enrichFullSetGarmentRows,
  finalizeFullSetGarmentAfterCompositeUpload,
  type VtonFullSetUploadSlot,
} from "@/lib/ecom/ecom-vton/full-set-garment-upload";
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
  cancelVtonProjectBatchTryon,
  setVtonDefaultLockedLook,
  unlockVtonLockedLook,
} from "@/lib/ecom/ecom-vton-project-mutations";
import {
  emptyVtonProjectMeta,
  mergeVtonMeta,
  resolveDefaultLockedLookUrl,
  sanitizeVtonProjectMeta,
} from "@/lib/ecom/ecom-vton/meta";
import {
  appendModelGeneration,
  confirmModelGeneration,
  ensureModelGenerationsFromRefs,
  refsWithActiveModelGeneration,
  removeModelGeneration,
  resolveActiveModelGeneration,
  resolvePreviewModelGeneration,
  setActiveModelGeneration,
  setPreviewModelGeneration,
  unconfirmModelGeneration,
} from "@/lib/ecom/ecom-vton/model-generations";
import { refineVtonProjectTryonResult } from "@/lib/ecom/ecom-vton/refine-vton-tryon-result";
import type {
  VtonGarmentItem,
  VtonLookSpec,
  VtonModelGeneration,
  VtonProjectMeta,
  VtonTryonRefinerGender,
} from "@/lib/ecom/ecom-vton/types";
import { ECOM_VTON_MODEL_ASSET_MODULE } from "@/lib/ecom/ecom-vton/types";
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
import { resolveVtonTextTryonModelKey } from "@/lib/ecom/ecom-vton-text-tryon-models";
import { ensureEcomVtonTextTryonDemoState } from "@/lib/ecom/ecom-vton-text-tryon-demo";
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
  if (raw === "already_dressed") return "already_dressed";
  if (raw === "text_to_tryon") return "text_to_tryon";
  return "need_tryon";
}

function sanitizeGarmentMode(raw: unknown): VtonGarmentMode {
  return raw === "one_piece" ? "one_piece" : "two_piece";
}

const VTON_MODEL_IMAGE_SIZE_VALUES = ["720*960", "1080*1440", "1536*2048"] as const;

function sanitizeModelImageSize(raw: unknown): string {
  const v = typeof raw === "string" ? raw.trim() : "";
  if ((VTON_MODEL_IMAGE_SIZE_VALUES as readonly string[]).includes(v)) return v;
  return "720*960";
}

function sanitizeSettings(raw: unknown): ModelTryonSettings {
  if (!raw || typeof raw !== "object") {
    return {
      outfitRefMode: "need_tryon",
      garmentMode: "two_piece",
      modelImageSize: "720*960",
    };
  }
  const o = raw as Record<string, unknown>;
  const outfitRefMode = sanitizeOutfitRefMode(o.outfitRefMode);
  return {
    outfitRefMode,
    garmentMode: sanitizeGarmentMode(o.garmentMode),
    modelImageSize: sanitizeModelImageSize(o.modelImageSize),
    textTryonModelKey:
      typeof o.textTryonModelKey === "string"
        ? resolveVtonTextTryonModelKey(o.textTryonModelKey)
        : resolveVtonTextTryonModelKey(undefined),
  };
}

async function detectUploadModelBodyCheck(
  userId: string,
  projectId: string,
  ossUrl: string,
) {
  return detectVtonModelImageBody({
    userId,
    imageUrl: ossUrl,
    projectId,
    action: "model-tryon__model-body-detect",
  });
}

function hydrateModelTryonDto(dto: ModelTryonProjectDto): ModelTryonProjectDto {
  const meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(dto.meta),
    dto.references,
  );
  return {
    ...dto,
    meta,
    references: refsWithActiveModelGeneration(dto.references, meta),
  };
}

async function persistAndAutoConfirmAiTryonModel(
  userId: string,
  projectId: string,
  project: ModelTryonProjectDto,
  entry: {
    ossUrl: string;
    label?: string;
    source?: NonNullable<WorkflowRefs["model"]>["source"];
    bodyCheck?: VtonModelGeneration["bodyCheck"];
  },
  opts?: { keepPreviewGenerationId?: string },
): Promise<ModelTryonProjectDto> {
  const dto = await persistNewModelGeneration(userId, projectId, project, entry, opts);
  if (entry.source !== "ai-generate") return dto;

  let meta = sanitizeVtonProjectMeta(dto.meta);
  const preview = resolvePreviewModelGeneration(meta);
  if (!preview || !canConfirmModelGenerationByBody(preview)) return dto;

  meta = confirmModelGeneration(meta, preview.id);
  return syncActiveModelTryonGeneration(userId, projectId, dto, meta);
}

async function persistNewModelGeneration(
  userId: string,
  projectId: string,
  project: ModelTryonProjectDto,
  entry: {
    ossUrl: string;
    label?: string;
    source?: NonNullable<WorkflowRefs["model"]>["source"];
    bodyCheck?: VtonModelGeneration["bodyCheck"];
  },
  opts?: { keepPreviewGenerationId?: string },
): Promise<ModelTryonProjectDto> {
  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );

  let bodyCheck = entry.bodyCheck;
  if (!bodyCheck) {
    if (entry.source === "ai-generate") {
      bodyCheck = vtonGenerationBodyCheckForAi();
    } else {
      try {
        const detected = await detectUploadModelBodyCheck(userId, projectId, entry.ossUrl);
        bodyCheck = vtonGenerationBodyCheckFromDetect(detected);
      } catch {
        bodyCheck = vtonGenerationBodyCheckFailed();
      }
    }
  }

  const appended = appendModelGeneration(
    meta,
    {
      ossUrl: entry.ossUrl,
      label: entry.label,
      source: entry.source,
      bodyCheck,
    },
    opts?.keepPreviewGenerationId
      ? { keepPreviewGenerationId: opts.keepPreviewGenerationId }
      : undefined,
  );
  meta = mergeVtonMeta(appended.meta, { tryonProgress: null });
  const references = refsWithActiveModelGeneration(project.references, meta);

  return updateEcomModelTryonProject(userId, projectId, { references, meta });
}

async function attachModelWithBodyCheck(
  userId: string,
  projectId: string,
  project: ModelTryonProjectDto,
  patch: Partial<WorkflowRefs>,
): Promise<ModelTryonProjectDto> {
  const model = patch.model;
  const ossUrl = model?.ossUrl?.trim();
  if (!ossUrl) {
    return updateEcomModelTryonProject(userId, projectId, {
      references: { ...project.references, ...patch },
      meta: mergeVtonMeta(sanitizeVtonProjectMeta(project.meta), {
        tryonProgress: null,
      }),
    });
  }

  return persistNewModelGeneration(userId, projectId, project, {
    ossUrl,
    label: model?.label,
    source: model?.source,
  });
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
  return hydrateModelTryonDto({
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
  });
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
  if (!row) return null;
  const dto = rowToDto(row);
  return ensureEcomVtonTextTryonDemoState(userId, dto);
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
  const dto = rowToDto(row);
  return ensureEcomVtonTextTryonDemoState(userId, dto);
}

export async function attachEcomModelTryonRefs(
  userId: string,
  projectId: string,
  patch: Partial<WorkflowRefs>,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  if (patch.model !== undefined) {
    return attachModelWithBodyCheck(userId, projectId, project, patch);
  }

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

  const patch: Partial<WorkflowRefs> = {
    [role]: {
      ossUrl: uploaded.ossUrl,
      source: "upload",
      label: labelByRole[role],
    },
  };

  if (role === "model") {
    const project = await getEcomModelTryonProject(userId, projectId);
    if (!project) throw new Error("项目不存在");
    return attachModelWithBodyCheck(userId, projectId, project, patch);
  }

  return attachEcomModelTryonRefs(userId, projectId, patch);
}

export async function generateEcomModelTryonModel(
  userId: string,
  projectId: string,
  opts?: { prompt?: string; imageSize?: string },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const settings = sanitizeSettings(project.settings);
  const imageSize = sanitizeModelImageSize(opts?.imageSize ?? settings.modelImageSize);

  const ossUrl = await generateVtonModelImage({
    userId,
    prompt: opts?.prompt,
    imageSize,
    toolKeySuffix: "model-tryon__model-generate",
  });

  return persistAndAutoConfirmAiTryonModel(userId, projectId, project, {
    ossUrl,
    label: "AI 全身模特",
    source: "ai-generate",
    bodyCheck: vtonGenerationBodyCheckForAi(),
  });
}

export async function expandEcomModelTryonModelFullBody(
  userId: string,
  projectId: string,
  opts?: { prompt?: string; imageSize?: string },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const settings = sanitizeSettings(project.settings);
  const imageSize = sanitizeModelImageSize(opts?.imageSize ?? settings.modelImageSize);

  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  const preview = resolvePreviewModelGeneration(meta);
  const portraitUrl =
    preview?.ossUrl?.trim() ?? project.references.model?.ossUrl?.trim();
  if (!portraitUrl) throw new Error("请先上传或选择模特图");

  const ossUrl = await expandVtonModelFullBody({
    userId,
    portraitUrl,
    prompt: opts?.prompt,
    imageSize,
    shotType: preview?.bodyCheck?.shotType,
    toolKeySuffix: "model-tryon__expand-full-body",
  });

  return persistAndAutoConfirmAiTryonModel(
    userId,
    projectId,
    { ...project, meta },
    {
      ossUrl,
      label: "AI 全身模特",
      source: "ai-generate",
      bodyCheck: vtonGenerationBodyCheckForAi(),
    },
  );
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
    update?: Array<{ id: string; patch: Partial<VtonGarmentItem> }>;
  },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const add = opts.add?.length
    ? await enrichFullSetGarmentRows(
        userId,
        projectId,
        ECOM_MODEL_TRYON_TOOL_KEY,
        opts.add,
      )
    : undefined;
  const meta = patchVtonGarmentPool(project.meta, {
    add,
    removeIds: opts.removeIds,
    update: opts.update,
  });
  return updateEcomModelTryonProject(userId, projectId, { meta });
}

export async function uploadEcomModelTryonGarment(
  userId: string,
  projectId: string,
  kind: VtonGarmentItem["kind"],
  file: File,
  opts?: { fullSetSlot?: VtonFullSetUploadSlot; garmentId?: string },
): Promise<ModelTryonProjectDto> {
  const buf = Buffer.from(await file.arrayBuffer());
  const uploaded = await resolveMediaDecomposeUpload({
    userId,
    buf,
    contentType: file.type,
    fileName: file.name,
  });
  if (uploaded.kind !== "image") throw new Error("请上传图片");
  const label = file.name.replace(/\.[^.]+$/, "") || VTON_GARMENT_KIND_LABELS[kind];
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const slot = opts?.fullSetSlot ?? (kind === "full_set" ? "composite" : undefined);
  if (kind === "full_set" && slot && slot !== "composite") {
    const meta = applyFullSetGarmentUpload({
      meta: sanitizeVtonProjectMeta(project.meta),
      kind,
      ossUrl: uploaded.ossUrl,
      label,
      source: "upload",
      fullSetSlot: slot,
      garmentId: opts?.garmentId,
    });
    return updateEcomModelTryonProject(userId, projectId, { meta });
  }

  if (kind === "full_set" && slot === "composite" && opts?.garmentId?.trim()) {
    let meta = applyFullSetGarmentUpload({
      meta: sanitizeVtonProjectMeta(project.meta),
      kind,
      ossUrl: uploaded.ossUrl,
      label,
      source: "upload",
      fullSetSlot: "composite",
      garmentId: opts.garmentId,
    });
    meta = await finalizeFullSetGarmentAfterCompositeUpload({
      meta,
      garmentId: opts.garmentId.trim(),
      userId,
      projectId,
      consumerToolKey: ECOM_MODEL_TRYON_TOOL_KEY,
    });
    return updateEcomModelTryonProject(userId, projectId, { meta });
  }

  const row: Omit<VtonGarmentItem, "id"> = {
    kind,
    ossUrl: uploaded.ossUrl,
    source: "upload",
    label,
  };
  const [enriched] = await enrichFullSetGarmentRows(
    userId,
    projectId,
    ECOM_MODEL_TRYON_TOOL_KEY,
    [row],
  );
  const meta = patchVtonGarmentPool(project.meta, { add: [enriched ?? row] });
  return updateEcomModelTryonProject(userId, projectId, { meta });
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

  const metaSnapshot = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  const prepared = prepareTryonModelGeneration(metaSnapshot);
  const modelUrl = prepared.generation.ossUrl.trim();

  if (prepared.didAutoConfirm) {
    await updateEcomModelTryonProject(userId, projectId, {
      meta: prepared.meta,
      references: refsWithActiveModelGeneration(project.references, prepared.meta),
    });
  }

  const meta = await runVtonProjectBatchTryon({
    userId,
    projectId,
    consumerToolKey: ECOM_MODEL_TRYON_TOOL_KEY,
    modelUrl,
    metaRaw: prepared.meta,
    looks: opts?.looks,
    persistMeta: async (m) => {
      await persistModelTryonMeta(userId, projectId, m);
    },
    loadMeta: async () => {
      const latest = await getEcomModelTryonProject(userId, projectId);
      return sanitizeVtonProjectMeta(latest?.meta);
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

export async function cancelEcomModelTryonBatch(
  userId: string,
  projectId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const meta = cancelVtonProjectBatchTryon(project.meta);
  return updateEcomModelTryonProject(userId, projectId, { meta });
}

export async function refineEcomModelTryonResult(
  userId: string,
  projectId: string,
  opts: { resultId: string; gender: VtonTryonRefinerGender },
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const metaSnapshot = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  const prepared = prepareTryonModelGeneration(metaSnapshot);
  const modelUrl = prepared.generation.ossUrl.trim();

  if (prepared.didAutoConfirm) {
    await updateEcomModelTryonProject(userId, projectId, {
      meta: prepared.meta,
      references: refsWithActiveModelGeneration(project.references, prepared.meta),
    });
  }

  const meta = await refineVtonProjectTryonResult({
    userId,
    projectId,
    consumerToolKey: ECOM_MODEL_TRYON_TOOL_KEY,
    modelUrl,
    resultId: opts.resultId,
    gender: opts.gender,
    metaRaw: project.meta,
    persistMeta: async (m) => {
      await persistModelTryonMeta(userId, projectId, m);
    },
  });

  return updateEcomModelTryonProject(userId, projectId, { meta });
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

async function syncActiveModelTryonGeneration(
  userId: string,
  projectId: string,
  project: ModelTryonProjectDto,
  meta: VtonProjectMeta,
): Promise<ModelTryonProjectDto> {
  const active = resolveActiveModelGeneration(meta);
  if (!active) throw new Error("未找到试衣模特");

  assertGenerationFullBodyForTryon(active);

  meta = mergeVtonMeta(meta, { tryonProgress: null });
  const references = refsWithActiveModelGeneration(project.references, meta);
  return updateEcomModelTryonProject(userId, projectId, { references, meta });
}

export async function setPreviewEcomModelTryonGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  meta = setPreviewModelGeneration(meta, generationId);

  const preview = resolvePreviewModelGeneration(meta);
  if (!preview) throw new Error("未找到该模特版本");

  // 左栏浏览仅切换 preview id，不跑全身识别、不改 refs.model，避免阻塞 UI / 服装区。
  // 全身识别在确认待试衣、切换试衣模特、上传时进行。
  return updateEcomModelTryonProject(userId, projectId, { meta });
}

export async function confirmEcomModelTryonGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  const generation = (meta.modelGenerations ?? []).find((g) => g.id === generationId.trim());
  if (!generation) throw new Error("未找到该模特版本");

  assertGenerationConfirmable(generation);
  meta = confirmModelGeneration(meta, generationId);

  return syncActiveModelTryonGeneration(userId, projectId, project, meta);
}

export async function unconfirmEcomModelTryonGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  meta = unconfirmModelGeneration(meta, generationId);

  const active = resolveActiveModelGeneration(meta);
  if (!active) {
    meta = mergeVtonMeta(meta, { tryonProgress: null });
    return updateEcomModelTryonProject(userId, projectId, {
      meta,
      references: { ...project.references, model: undefined },
    });
  }

  return syncActiveModelTryonGeneration(userId, projectId, project, meta);
}

export async function setActiveEcomModelTryonGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  meta = setActiveModelGeneration(meta, generationId);
  return syncActiveModelTryonGeneration(userId, projectId, project, meta);
}

export async function saveEcomModelTryonModelImage(
  userId: string,
  opts: { ossUrl: string; title?: string },
): Promise<{ assetId: string }> {
  const url = opts.ossUrl?.trim();
  if (!url) throw new Error("缺少模特图地址");

  const title = opts.title?.trim() || "模特全身照";

  const asset = await prisma.ecomAsset.create({
    data: {
      userId,
      module: ECOM_VTON_MODEL_ASSET_MODULE,
      kind: "image",
      title: title.slice(0, 120),
      ossUrl: url,
      thumbnailUrl: url,
      meta: { libraryRole: "my-model" as const },
    },
  });

  return { assetId: asset.id };
}

export async function removeEcomModelTryonGeneration(
  userId: string,
  projectId: string,
  generationId: string,
): Promise<ModelTryonProjectDto> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  let meta = ensureModelGenerationsFromRefs(
    sanitizeVtonProjectMeta(project.meta),
    project.references,
  );
  meta = removeModelGeneration(meta, generationId);

  const active = resolveActiveModelGeneration(meta);
  meta = mergeVtonMeta(meta, { tryonProgress: null });
  const references = refsWithActiveModelGeneration(project.references, meta);
  if (!active) {
    delete references.model;
  }

  return updateEcomModelTryonProject(userId, projectId, { references, meta });
}

export async function saveEcomModelTryonResultToAssets(
  userId: string,
  projectId: string,
  opts?: { title?: string; ossUrl?: string },
): Promise<{ assetId: string }> {
  const project = await getEcomModelTryonProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const url =
    opts?.ossUrl?.trim() ||
    resolveDefaultLockedLookUrl(sanitizeVtonProjectMeta(project.meta)) ||
    project.references.dressedImage?.ossUrl?.trim();
  if (!url) throw new Error("请先完成 AI 试衣");

  const existing = await prisma.ecomAsset.findFirst({
    where: { userId, module: ECOM_MODEL_TRYON_MODULE, ossUrl: url },
    select: { id: true },
  });
  if (existing) return { assetId: existing.id };

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

  try {
    const { persistEcomGenerationRecord } = await import("@/lib/ecom/ecom-generation-record");
    await persistEcomGenerationRecord({
      userId,
      ossUrl: url,
      kind: kind === "video" ? "video" : "image",
      title,
      meta: {
        sourceModule: ECOM_MODEL_TRYON_MODULE,
        sourceToolKey: ECOM_MODEL_TRYON_TOOL_KEY,
        projectId,
        versionKey: `${projectId}:tryon:${asset.id}`,
      },
    });
  } catch (e) {
    console.warn("[model-tryon] generation record failed:", e);
  }

  return { assetId: asset.id };
}
