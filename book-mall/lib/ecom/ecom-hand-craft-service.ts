import { Prisma } from "@prisma/client";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  getHandCraftStep,
  HAND_CRAFT_STEP_IDS,
  requireHandCraftStep,
  type HandCraftStepDef,
  type HandCraftStepId,
} from "@/lib/ecom/ecom-hand-craft-steps";
import {
  ECOM_HAND_CRAFT_MODULE,
  HAND_CRAFT_SKETCH_MAX,
  isHandCraftStepReady,
  parseHandCraftPlan,
  sanitizeHandCraftChatMessages,
  sanitizeHandCraftReferences,
  type HandCraftChatMessage,
  type HandCraftMeta,
  type HandCraftPlan,
  type HandCraftReference,
  type HandCraftSettings,
  type HandCraftSlot,
  type HandCraftStepState,
} from "@/lib/ecom/ecom-hand-craft-types";
import { prisma } from "@/lib/prisma";

export type EcomHandCraftProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: HandCraftSettings;
  references: HandCraftReference[];
  chatHistory: HandCraftChatMessage[];
  plan: HandCraftPlan;
  meta: HandCraftMeta | null;
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
export function hydrateHandCraftPlan(plan: HandCraftPlan): HandCraftPlan {
  const steps: HandCraftPlan["steps"] = { ...plan.steps };
  for (const stepId of HAND_CRAFT_STEP_IDS) {
    steps[stepId] = readHandCraftStepState(plan, stepId);
  }
  return { steps };
}

function rowToDto(row: Row): EcomHandCraftProjectDto {
  const plan = hydrateHandCraftPlan(parseHandCraftPlan(row.plan));
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: (row.settings as HandCraftSettings) ?? {},
    references: sanitizeHandCraftReferences(row.references),
    chatHistory: sanitizeHandCraftChatMessages(row.chatHistory),
    plan,
    meta: (row.meta as HandCraftMeta | null) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEcomHandCraftProjects(
  userId: string,
): Promise<EcomHandCraftProjectDto[]> {
  const rows = await prisma.ecomHandCraftProject.findMany({
    where: { userId, module: ECOM_HAND_CRAFT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listEcomHandCraftProjectSummaries(userId: string) {
  const rows = await prisma.ecomHandCraftProject.findMany({
    where: { userId, module: ECOM_HAND_CRAFT_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
    thumbnailUrl: sanitizeHandCraftReferences(row.references)[0]?.ossUrl ?? null,
  }));
}

export async function createEcomHandCraftProject(
  userId: string,
  opts?: { title?: string },
): Promise<EcomHandCraftProjectDto> {
  const row = await prisma.ecomHandCraftProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "手伴创作",
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      plan: { steps: {} } as Prisma.InputJsonValue,
      settings: {} as Prisma.InputJsonValue,
      meta: { workflow: { currentStepId: "hero" } } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomHandCraftProject(
  userId: string,
  projectId: string,
): Promise<EcomHandCraftProjectDto | null> {
  const row = await prisma.ecomHandCraftProject.findFirst({
    where: { id: projectId, userId },
  });
  return row ? rowToDto(row) : null;
}

export async function updateEcomHandCraftProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    brief?: Record<string, unknown>;
    settings?: HandCraftSettings;
    references?: HandCraftReference[];
    chatHistory?: HandCraftChatMessage[];
    /** 整份覆盖；按步增量请用 patchHandCraftStep */
    plan?: HandCraftPlan;
    status?: string;
    meta?: HandCraftMeta;
  },
): Promise<EcomHandCraftProjectDto> {
  const existing = await prisma.ecomHandCraftProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomHandCraftProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 120);
  if (patch.brief !== undefined) data.brief = patch.brief as Prisma.InputJsonValue;
  if (patch.settings !== undefined) {
    const prev = (existing.settings as HandCraftSettings | null) ?? {};
    data.settings = { ...prev, ...patch.settings } as Prisma.InputJsonValue;
  }
  if (patch.references !== undefined) {
    data.references = sanitizeHandCraftReferences(
      patch.references,
    ) as unknown as Prisma.InputJsonValue;
  }
  if (patch.chatHistory !== undefined) {
    data.chatHistory = sanitizeHandCraftChatMessages(
      patch.chatHistory,
    ) as unknown as Prisma.InputJsonValue;
  }
  if (patch.plan !== undefined) {
    data.plan = patch.plan as unknown as Prisma.InputJsonValue;
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.meta !== undefined) {
    const prev = (existing.meta as HandCraftMeta | null) ?? {};
    data.meta = {
      ...prev,
      ...patch.meta,
      workflow: { ...(prev.workflow ?? {}), ...(patch.meta.workflow ?? {}) },
    } as unknown as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomHandCraftProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

export async function deleteEcomHandCraftProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const row = await prisma.ecomHandCraftProject.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!row) throw new Error("项目不存在");
  await prisma.ecomHandCraftProject.delete({ where: { id: projectId } });
}

export async function addHandCraftSketchUpload(
  userId: string,
  projectId: string,
  opts: { label: string; buf: Buffer },
): Promise<HandCraftReference> {
  const project = await getEcomHandCraftProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  if (project.references.length >= HAND_CRAFT_SKETCH_MAX) {
    throw new Error(`最多上传 ${HAND_CRAFT_SKETCH_MAX} 张线稿`);
  }

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const ref: HandCraftReference = {
    id: `sketch-${Date.now()}-${project.references.length + 1}`,
    label: opts.label.slice(0, 40) || `线稿${project.references.length + 1}`,
    role: "sketch",
    ossUrl,
  };
  await updateEcomHandCraftProject(userId, projectId, {
    references: [...project.references, ref],
  });
  return ref;
}

/**
 * 换线稿 = 重启流程（文档通用规则第 3 条）：清空 10 步产出与基准形象锁定，
 * 已出图仍留在资产库，只是不再属于本项目的当前 IP。
 */
export async function resetHandCraftProjectForNewSketch(
  userId: string,
  projectId: string,
): Promise<EcomHandCraftProjectDto> {
  return updateEcomHandCraftProject(userId, projectId, {
    plan: { steps: {} },
    chatHistory: [],
    status: "draft",
    meta: { workflow: { currentStepId: "hero", heroLockedUrl: undefined } },
  });
}

export async function removeHandCraftReference(
  userId: string,
  projectId: string,
  refId: string,
): Promise<void> {
  const project = await getEcomHandCraftProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  await updateEcomHandCraftProject(userId, projectId, {
    references: project.references.filter((r) => r.id !== refId),
  });
}

function templateSlots(step: HandCraftStepDef): HandCraftSlot[] {
  return step.slots.map((s) => ({
    index: s.index,
    title: s.title,
    prompt: s.prompt,
  }));
}

export function emptyHandCraftStepState(step: HandCraftStepDef): HandCraftStepState {
  return {
    stepId: step.id,
    status: "pending",
    slots: templateSlots(step),
    outputs: [],
  };
}

/** 读某步状态；首次访问时按模板补齐槽位（不落库，落库由写操作触发） */
export function readHandCraftStepState(
  plan: HandCraftPlan,
  stepId: HandCraftStepId,
): HandCraftStepState {
  const step = requireHandCraftStep(stepId);
  const existing = plan.steps[stepId];
  if (!existing) return emptyHandCraftStepState(step);
  if (step.kind === "generate" && existing.slots.length === 0) {
    return { ...existing, slots: templateSlots(step) };
  }
  return existing;
}

/** 按步增量写：并发出图时逐张回写，不覆盖别的步骤 */
export async function patchHandCraftStep(
  userId: string,
  projectId: string,
  stepId: HandCraftStepId,
  patch: Partial<Omit<HandCraftStepState, "stepId">>,
): Promise<EcomHandCraftProjectDto> {
  const project = await getEcomHandCraftProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const prev = readHandCraftStepState(project.plan, stepId);
  const next: HandCraftStepState = {
    ...prev,
    ...patch,
    stepId,
    updatedAt: new Date().toISOString(),
  };
  const plan: HandCraftPlan = {
    steps: { ...project.plan.steps, [stepId]: next },
  };
  const allReady = readyStepIds(plan).length === HAND_CRAFT_STEP_IDS.length;
  return updateEcomHandCraftProject(userId, projectId, {
    plan,
    status: allReady ? "completed" : next.status === "generating" ? "generating" : "in_progress",
  });
}

export function readyStepIds(plan: HandCraftPlan): HandCraftStepId[] {
  return Object.entries(plan.steps)
    .filter(([, state]) => isHandCraftStepReady(state as HandCraftStepState))
    .map(([id]) => id as HandCraftStepId);
}

/** 依赖未齐备的步骤名，用于按钮置灰与助手提示 */
export function missingRequirementLabels(
  plan: HandCraftPlan,
  stepId: HandCraftStepId,
): string[] {
  const step = requireHandCraftStep(stepId);
  const ready = new Set(readyStepIds(plan));
  return step.requires
    .filter((id) => !ready.has(id))
    .map((id) => getHandCraftStep(id)?.label ?? id);
}

export async function patchHandCraftSlotPrompts(
  userId: string,
  projectId: string,
  stepId: HandCraftStepId,
  items: Array<{ index: number; title?: string; prompt?: string }>,
): Promise<EcomHandCraftProjectDto> {
  const project = await getEcomHandCraftProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const state = readHandCraftStepState(project.plan, stepId);
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
  return patchHandCraftStep(userId, projectId, stepId, {
    slots: [...byIndex.values()].sort((a, b) => a.index - b.index),
  });
}

/** 恢复本步槽位为模板默认（保留已手改的 Prompt） */
export async function resetHandCraftStepSlots(
  userId: string,
  projectId: string,
  stepId: HandCraftStepId,
): Promise<EcomHandCraftProjectDto> {
  const project = await getEcomHandCraftProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const step = requireHandCraftStep(stepId);
  const state = readHandCraftStepState(project.plan, stepId);
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
  return patchHandCraftStep(userId, projectId, stepId, { slots });
}
