import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  getBrandViStep,
  BRAND_VI_STEP_IDS,
  isBrandViStepId,
  requireBrandViStep,
  type BrandViStepDef,
  type BrandViStepId,
} from "@/lib/ecom/ecom-brand-vi-steps";
import {
  ECOM_BRAND_VI_MODULE,
  BRAND_VI_SKETCH_MAX,
  isBrandViStepReady,
  parseBrandViPlan,
  sanitizeBrandViChatMessages,
  sanitizeBrandViReferences,
  type BrandViChatMessage,
  type BrandViMeta,
  type BrandViPlan,
  type BrandViReference,
  type BrandViSettings,
  type BrandViSlot,
  type BrandViStepState,
} from "@/lib/ecom/ecom-brand-vi-types";
import {
  loadIpWorkflowProjectAssets,
  reconcileIpWorkflowPlanFromAssets,
} from "@/lib/ecom/ecom-ip-workflow-asset-reconcile";
import { mergeIpWorkflowStepSlots } from "@/lib/ecom/ecom-ip-workflow-slot-merge";
import { prisma } from "@/lib/prisma";

export type EcomBrandViProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: BrandViSettings;
  references: BrandViReference[];
  chatHistory: BrandViChatMessage[];
  plan: BrandViPlan;
  meta: BrandViMeta | null;
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
  chatHistory: unknown;
  plan: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

/** 读项目时补齐各步槽位模板，避免前端 plan.steps 为空时「生成全部」无槽位可点 */
export function hydrateBrandViPlan(plan: BrandViPlan): BrandViPlan {
  const steps: BrandViPlan["steps"] = { ...plan.steps };
  for (const stepId of BRAND_VI_STEP_IDS) {
    steps[stepId] = readBrandViStepState(plan, stepId);
  }
  return { steps };
}

function rowToDto(row: Row): EcomBrandViProjectDto {
  const plan = hydrateBrandViPlan(parseBrandViPlan(row.plan));
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: (row.settings as BrandViSettings) ?? {},
    references: sanitizeBrandViReferences(row.references),
    chatHistory: sanitizeBrandViChatMessages(row.chatHistory),
    plan,
    meta: (row.meta as BrandViMeta | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEcomBrandViProjects(
  userId: string,
): Promise<EcomBrandViProjectDto[]> {
  const rows = await prisma.ecomBrandViProject.findMany({
    where: { userId, module: ECOM_BRAND_VI_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listEcomBrandViProjectSummaries(userId: string) {
  const rows = await prisma.ecomBrandViProject.findMany({
    where: { userId, module: ECOM_BRAND_VI_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    thumbnailUrl: sanitizeBrandViReferences(row.references)[0]?.ossUrl ?? null,
  }));
}

export async function createEcomBrandViProject(
  userId: string,
  opts?: { title?: string },
): Promise<EcomBrandViProjectDto> {
  const row = await prisma.ecomBrandViProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "品牌VI表情包SOP",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      plan: { steps: {} } as Prisma.InputJsonValue,
      settings: {} as Prisma.InputJsonValue,
      meta: { workflow: { currentStepId: "hero" } } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

function brandViSlotTemplateForReconcile(stepId: string, index: number) {
  if (!isBrandViStepId(stepId)) {
    return { index, title: `#${index}`, prompt: "" };
  }
  const step = getBrandViStep(stepId);
  if (!step || step.kind !== "generate") {
    return { index, title: `#${index}`, prompt: "" };
  }
  const tpl = step.slots.find((s) => s.index === index);
  return tpl
    ? { index: tpl.index, title: tpl.title, prompt: tpl.prompt }
    : { index, title: `#${index}`, prompt: "" };
}

export async function syncEcomBrandViProjectPlanFromAssets(
  userId: string,
  projectId: string,
): Promise<{ project: EcomBrandViProjectDto | null; recoveredImages: number }> {
  const row = await prisma.ecomBrandViProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return { project: null, recoveredImages: 0 };
  let dto = rowToDto(row);
  const byStepIndex = await loadIpWorkflowProjectAssets({
    userId,
    module: ECOM_BRAND_VI_MODULE,
    projectId,
    source: "brand-vi",
  });
  if (byStepIndex.size === 0) return { project: dto, recoveredImages: 0 };
  const { plan, recoveredImages } = reconcileIpWorkflowPlanFromAssets({
    plan: dto.plan,
    byStepIndex,
    resolveSlotTemplate: brandViSlotTemplateForReconcile,
  });
  if (recoveredImages === 0) return { project: dto, recoveredImages: 0 };
  dto = await updateEcomBrandViProject(userId, projectId, { plan });
  return { project: dto, recoveredImages };
}

export async function getEcomBrandViProject(
  userId: string,
  projectId: string,
): Promise<EcomBrandViProjectDto | null> {
  const { project } = await syncEcomBrandViProjectPlanFromAssets(userId, projectId);
  return project;
}

export async function updateEcomBrandViProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    brief?: Record<string, unknown>;
    settings?: BrandViSettings;
    references?: BrandViReference[];
    chatHistory?: BrandViChatMessage[];
    /** 整份覆盖；按步增量请用 patchBrandViStep */
    plan?: BrandViPlan;
    status?: string;
    meta?: BrandViMeta;
  },
): Promise<EcomBrandViProjectDto> {
  const existing = await prisma.ecomBrandViProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomBrandViProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 120);
  if (patch.brief !== undefined) data.brief = patch.brief as Prisma.InputJsonValue;
  if (patch.settings !== undefined) {
    const prev = (existing.settings as BrandViSettings | null) ?? {};
    const next = { ...prev, ...patch.settings };
    const styleChanged =
      (patch.settings.stylePresetId !== undefined &&
        patch.settings.stylePresetId !== prev.stylePresetId) ||
      (patch.settings.styleCustomText !== undefined &&
        (patch.settings.styleCustomText ?? "").trim() !== (prev.styleCustomText ?? "").trim());
    data.settings = next as Prisma.InputJsonValue;
    if (styleChanged && patch.plan === undefined) {
      data.plan = { steps: {} } as Prisma.InputJsonValue;
      const prevMeta = (existing.meta as BrandViMeta | null) ?? {};
      data.meta = {
        ...prevMeta,
        workflow: {
          ...(prevMeta.workflow ?? {}),
          currentStepId: "hero",
          heroLockedUrl: undefined,
        },
      } as unknown as Prisma.InputJsonValue;
    }
  }
  if (patch.references !== undefined) {
    data.references = sanitizeBrandViReferences(
      patch.references,
    ) as unknown as Prisma.InputJsonValue;
  }
  if (patch.chatHistory !== undefined) {
    data.chatHistory = sanitizeBrandViChatMessages(
      patch.chatHistory,
    ) as unknown as Prisma.InputJsonValue;
  }
  if (patch.plan !== undefined) {
    data.plan = patch.plan as unknown as Prisma.InputJsonValue;
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.meta !== undefined) {
    const prev = (existing.meta as BrandViMeta | null) ?? {};
    data.meta = {
      ...prev,
      ...patch.meta,
      workflow: { ...(prev.workflow ?? {}), ...(patch.meta.workflow ?? {}) },
    } as unknown as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomBrandViProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

export async function deleteEcomBrandViProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const row = await prisma.ecomBrandViProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!row) throw new Error("项目不存在");
  await prisma.ecomBrandViProject.delete({ where: { id: projectId } });
}

export async function addBrandViSketchUpload(
  userId: string,
  projectId: string,
  opts: { label: string; buf: Buffer },
): Promise<BrandViReference> {
  const project = await getEcomBrandViProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length >= BRAND_VI_SKETCH_MAX) {
    throw new Error(`最多上传 ${BRAND_VI_SKETCH_MAX} 张线稿`);
  }

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const ref: BrandViReference = {
    id: `sketch-${Date.now()}-${project.references.length + 1}`,
    label: opts.label.slice(0, 40) || `线稿${project.references.length + 1}`,
    role: "sketch",
    ossUrl,
  };
  await updateEcomBrandViProject(userId, projectId, {
    references: [...project.references, ref],
  });
  return ref;
}

/**
 * 换线稿 = 重启流程（文档通用规则第 3 条）：清空 10 步产出与基准形象锁定，
 * 已出图仍留在资产库，只是不再属于本项目的当前 IP。
 */
export async function resetBrandViProjectForNewSketch(
  userId: string,
  projectId: string,
): Promise<EcomBrandViProjectDto> {
  return updateEcomBrandViProject(userId, projectId, {
    plan: { steps: {} },
    chatHistory: [],
    status: "draft",
    meta: { workflow: { currentStepId: "hero", heroLockedUrl: undefined } },
  });
}

export async function removeBrandViReference(
  userId: string,
  projectId: string,
  refId: string,
): Promise<void> {
  const project = await getEcomBrandViProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  await updateEcomBrandViProject(userId, projectId, {
    references: project.references.filter((r) => r.id !== refId),
  });
}

/** 从「我的资产」挂线稿参考图（不重新上传 OSS） */
export async function attachBrandViSketchesFromAssets(
  userId: string,
  projectId: string,
  assetIds: string[],
): Promise<EcomBrandViProjectDto> {
  const project = await getEcomBrandViProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const remaining = BRAND_VI_SKETCH_MAX - project.references.length;
  if (remaining <= 0) {
    throw new Error(`最多 ${BRAND_VI_SKETCH_MAX} 张线稿`);
  }

  const ids = [...new Set(assetIds.filter((id) => id.trim()))].slice(0, remaining);
  if (ids.length === 0) throw new Error("请至少选择一张资产图");

  const assets = await prisma.ecomAsset.findMany({
    where: { userId, id: { in: ids }, kind: "image" },
    select: { id: true, title: true, ossUrl: true },
  });
  if (assets.length === 0) throw new Error("找不到所选资产");

  const added: BrandViReference[] = [];
  for (const asset of assets) {
    const url = asset.ossUrl?.trim();
    if (!url || !/^https?:\/\//.test(url)) continue;
    added.push({
      id: `sketch-${asset.id.slice(-8)}-${Date.now()}${added.length}`,
      label: (asset.title ?? "资产图").slice(0, 40),
      role: "sketch",
      ossUrl: url,
    });
  }
  if (added.length === 0) throw new Error("所选资产不可用");

  return updateEcomBrandViProject(userId, projectId, {
    references: [...project.references, ...added],
  });
}

function templateSlots(step: BrandViStepDef): BrandViSlot[] {
  return step.slots.map((s) => ({
    index: s.index,
    title: s.title,
    prompt: s.prompt,
  }));
}

export function emptyBrandViStepState(step: BrandViStepDef): BrandViStepState {
  return {
    stepId: step.id,
    status: "pending",
    slots: templateSlots(step),
    outputs: [],
  };
}

/** 读某步状态；首次访问时按模板补齐槽位（不落库，落库由写操作触发） */
export function readBrandViStepState(
  plan: BrandViPlan,
  stepId: BrandViStepId,
): BrandViStepState {
  const step = requireBrandViStep(stepId);
  const existing = plan.steps[stepId];
  if (!existing) return emptyBrandViStepState(step);
  if (step.kind === "generate" && existing.slots.length === 0) {
    return { ...existing, slots: templateSlots(step) };
  }
  return existing;
}

/** 出图逐张回写 plan 时走轻量读库，避免每张都 reconcile 资产拖慢 GET/轮询 */
async function loadEcomBrandViProjectForPatch(
  userId: string,
  projectId: string,
): Promise<EcomBrandViProjectDto | null> {
  const row = await prisma.ecomBrandViProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  return rowToDto(row);
}

/** 按步增量写：并发出图时逐张回写，不覆盖别的步骤 */
export async function patchBrandViStep(
  userId: string,
  projectId: string,
  stepId: BrandViStepId,
  patch: Partial<Omit<BrandViStepState, "stepId">>,
): Promise<EcomBrandViProjectDto> {
  const project = await loadEcomBrandViProjectForPatch(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const prev = readBrandViStepState(project.plan, stepId);
  const mergedSlots =
    patch.slots !== undefined
      ? mergeIpWorkflowStepSlots(prev.slots, patch.slots)
      : undefined;
  const next: BrandViStepState = {
    ...prev,
    ...patch,
    ...(mergedSlots !== undefined ? { slots: mergedSlots } : {}),
    stepId,
    updatedAt: new Date().toISOString(),
  };
  const plan: BrandViPlan = {
    steps: { ...project.plan.steps, [stepId]: next },
  };
  const allReady = readyStepIds(plan).length === BRAND_VI_STEP_IDS.length;
  return updateEcomBrandViProject(userId, projectId, {
    plan,
    status: allReady ? "completed" : next.status === "generating" ? "generating" : "in_progress",
  });
}

export function readyStepIds(plan: BrandViPlan): BrandViStepId[] {
  return Object.entries(plan.steps)
    .filter(([, state]) => isBrandViStepReady(state as BrandViStepState))
    .map(([id]) => id as BrandViStepId);
}

/** 依赖未齐备的步骤名，用于按钮置灰与助手提示 */
export function missingRequirementLabels(
  plan: BrandViPlan,
  stepId: BrandViStepId,
): string[] {
  const step = requireBrandViStep(stepId);
  const ready = new Set(readyStepIds(plan));
  return step.requires
    .filter((id) => !ready.has(id))
    .map((id) => getBrandViStep(id)?.label ?? id);
}

export async function patchBrandViSlotPrompts(
  userId: string,
  projectId: string,
  stepId: BrandViStepId,
  items: Array<{ index: number; title?: string; prompt?: string }>,
): Promise<EcomBrandViProjectDto> {
  const project = await getEcomBrandViProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const state = readBrandViStepState(project.plan, stepId);
  const byIndex = new Map(state.slots.map((s) => [s.index, s]));
  for (const item of items) {
    const slot = byIndex.get(item.index);
    if (!slot) continue;
    byIndex.set(item.index, {
      ...slot,
      title: item.title?.trim() ? item.title.trim().slice(0, 60) : slot.title,
      prompt: item.prompt !== undefined ? item.prompt.slice(0, 4000) : slot.prompt,
      promptEdited:
        item.prompt !== undefined && item.prompt !== slot.prompt
          ? true
          : slot.promptEdited,
    });
  }
  return patchBrandViStep(userId, projectId, stepId, {
    slots: [...byIndex.values()].sort((a, b) => a.index - b.index),
  });
}

/** 恢复本步槽位为模板默认（保留已手改的 Prompt） */
export async function resetBrandViStepSlots(
  userId: string,
  projectId: string,
  stepId: BrandViStepId,
): Promise<EcomBrandViProjectDto> {
  const project = await getEcomBrandViProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const step = requireBrandViStep(stepId);
  const state = readBrandViStepState(project.plan, stepId);
  const byIndex = new Map(state.slots.map((s) => [s.index, s]));
  const slots = templateSlots(step).map((tpl) => {
    const old = byIndex.get(tpl.index);
    if (!old) return tpl;
    return {
      ...tpl,
      prompt: old.promptEdited ? old.prompt : tpl.prompt,
      promptEdited: old.promptEdited,
      imageUrl: old.imageUrl,
      assetId: old.assetId,
    };
  });
  return patchBrandViStep(userId, projectId, stepId, { slots });
}
