import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import type { FilmPullRenderScriptPatch } from "@/lib/ecom/ecom-film-pull-structured";
import {
  ECOM_FILM_PULL_DEFAULT_CHAT_MODEL,
  ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL,
  ECOM_FILM_PULL_MODULE,
  sanitizeFilmPullAnalyzeResult,
  sanitizeFilmPullCharacterRefs,
  sanitizeFilmPullChatHistory,
  sanitizeFilmPullMedia,
  sanitizeFilmPullProductionPlan,
  sanitizeFilmPullRefMatch,
  sanitizeFilmPullRenderPlan,
  sanitizeFilmPullRenderScriptResult,
  sanitizeFilmPullSettings,
  type FilmPullAnalyzePatch,
  type FilmPullCharacterRef,
  type FilmPullChatMessage,
  type FilmPullMediaReference,
  type FilmPullProductionPlan,
  type FilmPullProductionShot,
  type FilmPullProjectDto,
  type FilmPullRefMatch,
  type FilmPullRenderPlan,
  type FilmPullSettings,
  type FilmPullStoredAnalyze,
  type FilmPullStructuredResult,
  isLegacyFilmPullAnalyzePatch,
  isEcomFilmPullAnalyzeActive,
} from "@/lib/ecom/ecom-film-pull-types";
import { prisma } from "@/lib/prisma";
import {
  abortFilmPullAnalyzeRun,
} from "@/lib/ecom/ecom-film-pull-analyze-run";

function assertFilmPullPrismaDelegate(): void {
  const delegate = (
    prisma as unknown as {
      ecomFilmPullProject?: { create?: unknown };
    }
  ).ecomFilmPullProject;
  if (typeof delegate?.create !== "function") {
    throw new Error(
      "数据库客户端未包含专业拉片项目表，请在 book-mall 执行 pnpm db:generate 并重启 dev:all",
    );
  }
}

/** 当前进程加载的 Prisma Client 是否已含 V2 制作成片字段 */
function ecomFilmPullProjectHasProductionV2Fields(): boolean {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === "EcomFilmPullProject");
  const names = new Set(model?.fields.map((f) => f.name) ?? []);
  return names.has("refMatch") && names.has("productionPlan");
}

function filmPullProductionV2ClearInput():
  | { refMatch: typeof Prisma.JsonNull; productionPlan: typeof Prisma.JsonNull }
  | Record<string, never> {
  if (!ecomFilmPullProjectHasProductionV2Fields()) return {};
  return { refMatch: Prisma.JsonNull, productionPlan: Prisma.JsonNull };
}

function filmPullProductionV2DbClearInput():
  | { refMatch: typeof Prisma.DbNull; productionPlan: typeof Prisma.DbNull }
  | Record<string, never> {
  if (!ecomFilmPullProjectHasProductionV2Fields()) return {};
  return { refMatch: Prisma.DbNull, productionPlan: Prisma.DbNull };
}

function readMetaRecord(meta: unknown): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  return meta as Record<string, unknown>;
}

function resolveFilmPullRefMatchFromRow(row: {
  refMatch?: unknown;
  meta?: unknown;
}): FilmPullRefMatch | null {
  return (
    sanitizeFilmPullRefMatch(row.refMatch) ??
    sanitizeFilmPullRefMatch(readMetaRecord(row.meta).refMatch)
  );
}

function resolveFilmPullProductionPlanFromRow(row: {
  productionPlan?: unknown;
  meta?: unknown;
}): FilmPullProductionPlan | null {
  return (
    sanitizeFilmPullProductionPlan(row.productionPlan) ??
    sanitizeFilmPullProductionPlan(readMetaRecord(row.meta).productionPlan)
  );
}

function clearFilmPullProductionMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const next = { ...meta };
  delete next.refMatch;
  delete next.productionPlan;
  delete next.refMatchConfirmedAt;
  delete next.productionScriptConfirmedAt;
  return next;
}

function rowToDto(row: {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: unknown;
  references: unknown;
  analyzeResult: unknown;
  renderScript: unknown;
  characterRefs: unknown;
  renderPlan: unknown;
  refMatch: unknown;
  productionPlan: unknown;
  chatHistory: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
}): FilmPullProjectDto {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    settings: sanitizeFilmPullSettings(row.settings),
    media: sanitizeFilmPullMedia(row.references),
    analyzeResult: sanitizeFilmPullAnalyzeResult(row.analyzeResult),
    renderScript: sanitizeFilmPullRenderScriptResult(row.renderScript),
    characterRefs: sanitizeFilmPullCharacterRefs(row.characterRefs),
    renderPlan: sanitizeFilmPullRenderPlan(row.renderPlan),
    refMatch: resolveFilmPullRefMatchFromRow(row),
    productionPlan: resolveFilmPullProductionPlanFromRow(row),
    chatHistory: sanitizeFilmPullChatHistory(row.chatHistory),
    meta: (row.meta as FilmPullProjectDto["meta"]) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function getOwnedRow(userId: string, projectId: string) {
  return prisma.ecomFilmPullProject.findFirst({
    where: { userId, id: projectId, module: ECOM_FILM_PULL_MODULE },
  });
}

/** 修正 analyzing/render_scripting 与 completedAt 不一致的脏状态 */
function reconcileFilmPullProjectStatus(
  dto: FilmPullProjectDto,
): { dto: FilmPullProjectDto; statusPatch?: string } {
  if (
    dto.status === "analyzing" &&
    dto.analyzeResult?.completedAt
  ) {
    const nextStatus = dto.analyzeResult.structured ? "analyzed" : "failed";
    return { dto: { ...dto, status: nextStatus }, statusPatch: nextStatus };
  }
  if (
    dto.status === "render_scripting" &&
    dto.renderScript?.completedAt
  ) {
    const nextStatus = dto.renderScript.structured ? "render_ready" : "failed";
    return { dto: { ...dto, status: nextStatus }, statusPatch: nextStatus };
  }
  return { dto };
}

function assertFilmPullMediaMutable(status: string): void {
  if (status === "analyzing" || status === "render_scripting") {
    throw new Error("拉片进行中，暂不可更换或删除源视频");
  }
}

export async function listEcomFilmPullProjects(userId: string): Promise<FilmPullProjectDto[]> {
  const rows = await prisma.ecomFilmPullProject.findMany({
    where: { userId, module: ECOM_FILM_PULL_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listEcomFilmPullProjectSummaries(userId: string) {
  const rows = await prisma.ecomFilmPullProject.findMany({
    where: { userId, module: ECOM_FILM_PULL_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, status: true, updatedAt: true, references: true },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status,
    updatedAt: r.updatedAt.toISOString(),
    hasMedia: Boolean(sanitizeFilmPullMedia(r.references)?.ossUrl),
  }));
}

export async function createEcomFilmPullProject(
  userId: string,
  opts?: { title?: string; sourceApp?: "ecom" | "canvas"; canvasProjectId?: string },
): Promise<FilmPullProjectDto> {
  assertFilmPullPrismaDelegate();
  const row = await prisma.ecomFilmPullProject.create({
    data: {
      userId,
      module: ECOM_FILM_PULL_MODULE,
      title: opts?.title?.trim() || "专业拉片",
      settings: {
        chatModelKey: ECOM_FILM_PULL_DEFAULT_CHAT_MODEL,
        videoModelKey: ECOM_FILM_PULL_DEFAULT_VIDEO_MODEL,
        aspectRatio: "9:16",
      } as Prisma.InputJsonValue,
      meta: {
        analyzeMode: "single",
        sourceApp: opts?.sourceApp ?? "ecom",
        ...(opts?.canvasProjectId ? { canvasProjectId: opts.canvasProjectId } : {}),
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function getEcomFilmPullProject(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto | null> {
  const row = await getOwnedRow(userId, projectId);
  if (!row) return null;
  const dto = rowToDto(row);
  const { dto: reconciled, statusPatch } = reconcileFilmPullProjectStatus(dto);
  if (statusPatch) {
    await prisma.ecomFilmPullProject.update({
      where: { id: projectId },
      data: { status: statusPatch },
    });
  }
  return reconciled;
}

export async function updateEcomFilmPullProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    status: string;
    settings: FilmPullSettings;
    analyzeResult: FilmPullStructuredResult<FilmPullStoredAnalyze> | null;
    renderScript: FilmPullStructuredResult<FilmPullRenderScriptPatch> | null;
    characterRefs: FilmPullCharacterRef[];
    renderPlan: FilmPullRenderPlan | null;
    refMatch: FilmPullRefMatch | null;
    productionPlan: FilmPullProductionPlan | null;
    chatHistory: FilmPullChatMessage[];
    meta: Record<string, unknown>;
    media: FilmPullMediaReference | null;
  }>,
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const prevSettings = sanitizeFilmPullSettings(existing.settings);
  const nextSettings = patch.settings ? { ...prevSettings, ...patch.settings } : prevSettings;

  const hasV2 = ecomFilmPullProjectHasProductionV2Fields();
  const metaDelta: Record<string, unknown> = { ...(patch.meta ?? {}) };
  if (!hasV2) {
    if (patch.refMatch !== undefined) metaDelta.refMatch = patch.refMatch;
    if (patch.productionPlan !== undefined) metaDelta.productionPlan = patch.productionPlan;
  }

  let nextMeta: Prisma.InputJsonValue | undefined;
  if (
    patch.meta !== undefined ||
    (!hasV2 && (patch.refMatch !== undefined || patch.productionPlan !== undefined))
  ) {
    const prevMeta = readMetaRecord(existing.meta);
    const merged: Record<string, unknown> = { ...prevMeta, ...metaDelta };
    for (const [key, value] of Object.entries(metaDelta)) {
      if (value === null) delete merged[key];
    }
    nextMeta = merged as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomFilmPullProject.update({
    where: { id: projectId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() || null } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.settings !== undefined
        ? { settings: nextSettings as Prisma.InputJsonValue }
        : {}),
      ...(patch.analyzeResult !== undefined
        ? { analyzeResult: (patch.analyzeResult ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(patch.renderScript !== undefined
        ? { renderScript: (patch.renderScript ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(patch.characterRefs !== undefined
        ? { characterRefs: patch.characterRefs as Prisma.InputJsonValue }
        : {}),
      ...(patch.renderPlan !== undefined
        ? { renderPlan: (patch.renderPlan ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(patch.refMatch !== undefined && hasV2
        ? { refMatch: (patch.refMatch ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(patch.productionPlan !== undefined && hasV2
        ? { productionPlan: (patch.productionPlan ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(patch.chatHistory !== undefined
        ? { chatHistory: patch.chatHistory as Prisma.InputJsonValue }
        : {}),
      ...(patch.media !== undefined
        ? { references: (patch.media ?? null) as Prisma.InputJsonValue }
        : {}),
      ...(nextMeta !== undefined ? { meta: nextMeta } : {}),
    },
  });
  return rowToDto(row);
}

/** 原子占用拉片槽位：DB 条件更新 + 拒绝并发重复提交 */
export async function claimFilmPullAnalyzeSlot(
  userId: string,
  projectId: string,
  patch: {
    runId: string;
    startedAt: string;
    chatModelKey: string;
    lastAnalyzePrompt: string;
    settings: FilmPullSettings;
    meta: FilmPullProjectDto["meta"];
  },
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  if (!sanitizeFilmPullMedia(existing.references)?.ossUrl) {
    throw new Error("请先上传视频");
  }

  const updated = await prisma.ecomFilmPullProject.updateMany({
    where: {
      userId,
      id: projectId,
      module: ECOM_FILM_PULL_MODULE,
      status: { not: "analyzing" },
    },
    data: {
      status: "analyzing",
      analyzeResult: Prisma.DbNull,
      renderScript: Prisma.DbNull,
      renderPlan: Prisma.DbNull,
      ...filmPullProductionV2DbClearInput(),
      settings: {
        ...patch.settings,
        chatModelKey: patch.chatModelKey,
        lastAnalyzePrompt: patch.lastAnalyzePrompt,
      } as Prisma.InputJsonValue,
      meta: {
        ...(patch.meta ?? {}),
        analyzeRunId: patch.runId,
        analyzeCancelRunId: null,
        analyzeStartedAt: patch.startedAt,
      } as Prisma.InputJsonValue,
    },
  });

  if (updated.count === 0) {
    const dto = rowToDto(existing);
    const { dto: reconciled } = reconcileFilmPullProjectStatus(dto);
    if (isEcomFilmPullAnalyzeActive(reconciled)) {
      throw new Error("拉片进行中，请等待完成或先中止");
    }
    throw new Error("无法开始拉片，请刷新后重试");
  }

  const row = await getOwnedRow(userId, projectId);
  if (!row) throw new Error("项目不存在");
  return rowToDto(row);
}

export async function deleteEcomFilmPullProject(userId: string, projectId: string): Promise<void> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  await prisma.ecomFilmPullProject.delete({ where: { id: projectId } });
}

export async function cancelEcomFilmPullAnalyze(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  const project = reconcileFilmPullProjectStatus(rowToDto(existing)).dto;
  const runId = project.meta?.analyzeRunId ?? "forced";

  if (!isEcomFilmPullAnalyzeActive(project) && project.status !== "analyzing") {
    return project;
  }

  abortFilmPullAnalyzeRun(userId, projectId);

  const canceledResult: FilmPullStructuredResult<FilmPullStoredAnalyze> = {
    rawText: project.analyzeResult?.rawText ?? "",
    structured: null,
    parseError: "拉片已中止",
    completedAt: new Date().toISOString(),
  };

  return updateEcomFilmPullProject(userId, projectId, {
    status: "failed",
    analyzeResult: canceledResult,
    meta: {
      analyzeCancelRunId: runId,
      analyzeStartedAt: null,
    },
  });
}

async function setProjectMedia(
  userId: string,
  projectId: string,
  media: FilmPullMediaReference,
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  const current = rowToDto(existing);
  const { dto: reconciled } = reconcileFilmPullProjectStatus(current);
  assertFilmPullMediaMutable(reconciled.status);

  const row = await prisma.ecomFilmPullProject.update({
    where: { id: projectId },
    data: {
      references: media as Prisma.InputJsonValue,
      analyzeResult: Prisma.JsonNull,
      renderScript: Prisma.JsonNull,
      renderPlan: Prisma.JsonNull,
      ...filmPullProductionV2ClearInput(),
      ...(!ecomFilmPullProjectHasProductionV2Fields()
        ? { meta: clearFilmPullProductionMeta(readMetaRecord(existing.meta)) as Prisma.InputJsonValue }
        : {}),
      status: "draft",
    },
  });
  return rowToDto(row);
}

export async function uploadFilmPullMedia(
  userId: string,
  projectId: string,
  media: FilmPullMediaReference,
): Promise<FilmPullProjectDto> {
  return setProjectMedia(userId, projectId, media);
}

export async function clearFilmPullMedia(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  const current = rowToDto(existing);
  const { dto: reconciled } = reconcileFilmPullProjectStatus(current);
  assertFilmPullMediaMutable(reconciled.status);

  const row = await prisma.ecomFilmPullProject.update({
    where: { id: projectId },
    data: {
      references: Prisma.JsonNull,
      analyzeResult: Prisma.JsonNull,
      renderScript: Prisma.JsonNull,
      renderPlan: Prisma.JsonNull,
      ...filmPullProductionV2ClearInput(),
      ...(!ecomFilmPullProjectHasProductionV2Fields()
        ? { meta: clearFilmPullProductionMeta(readMetaRecord(existing.meta)) as Prisma.InputJsonValue }
        : {}),
      status: "draft",
    },
  });
  return rowToDto(row);
}

export async function addFilmPullCharacterRef(
  userId: string,
  projectId: string,
  ref: FilmPullCharacterRef,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const next = [...project.characterRefs.filter((r) => r.id !== ref.id), ref].slice(0, 5);
  return updateEcomFilmPullProject(userId, projectId, { characterRefs: next });
}

export async function appendFilmPullRef(
  userId: string,
  projectId: string,
  role: import("@/lib/ecom/ecom-film-pull-refs").FilmPullRefRole,
  ossUrl: string,
): Promise<FilmPullProjectDto> {
  const { appendFilmPullReference } = await import("@/lib/ecom/ecom-film-pull-refs");
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const { refs } = appendFilmPullReference(project.characterRefs, role, ossUrl);
  return updateEcomFilmPullProject(userId, projectId, { characterRefs: refs });
}

export async function removeFilmPullRef(
  userId: string,
  projectId: string,
  refId: string,
): Promise<FilmPullProjectDto> {
  const { removeFilmPullReference } = await import("@/lib/ecom/ecom-film-pull-refs");
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const refs = removeFilmPullReference(project.characterRefs, refId);
  return updateEcomFilmPullProject(userId, projectId, { characterRefs: refs });
}

export async function removeFilmPullCharacterRef(
  userId: string,
  projectId: string,
  refId: string,
): Promise<FilmPullProjectDto> {
  return removeFilmPullRef(userId, projectId, refId);
}

/** 从平台模特库追加模特参考图（OSS URL 直引，不上传副本） */
export async function attachFilmPullModelFromLibrary(
  userId: string,
  projectId: string,
  entry: { id: string; name?: string; ossUrl: string },
): Promise<FilmPullProjectDto> {
  const ossUrl = entry.ossUrl?.trim();
  if (!entry.id?.trim() || !ossUrl || !/^https?:\/\//i.test(ossUrl)) {
    throw new Error("无效的模特库条目");
  }
  return appendFilmPullRef(userId, projectId, "model", ossUrl);
}

/** 从「我的资产」追加模特/产品参考图（不重新上传 OSS） */
export async function attachFilmPullRefsFromAssets(
  userId: string,
  projectId: string,
  role: import("@/lib/ecom/ecom-film-pull-refs").FilmPullRefRole,
  assetIds: string[],
): Promise<FilmPullProjectDto> {
  const {
    appendFilmPullReference,
    FILM_PULL_REF_MAX_PER_ROLE,
    listFilmPullModelRefs,
    listFilmPullProductRefs,
  } = await import("@/lib/ecom/ecom-film-pull-refs");

  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const existing =
    role === "model"
      ? listFilmPullModelRefs(project.characterRefs)
      : listFilmPullProductRefs(project.characterRefs);
  const remaining = FILM_PULL_REF_MAX_PER_ROLE - existing.length;
  if (remaining <= 0) {
    throw new Error(
      role === "model"
        ? `模特图最多 ${FILM_PULL_REF_MAX_PER_ROLE} 张`
        : `产品图最多 ${FILM_PULL_REF_MAX_PER_ROLE} 张`,
    );
  }

  const ids = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))].slice(0, remaining);
  if (ids.length === 0) throw new Error("请至少选择一张资产图");

  const assets = await prisma.ecomAsset.findMany({
    where: { userId, id: { in: ids }, kind: "image" },
    select: { id: true, ossUrl: true },
  });
  if (assets.length === 0) throw new Error("找不到所选资产");

  let currentRefs = project.characterRefs;
  let addedCount = 0;

  for (const asset of assets) {
    const url = asset.ossUrl?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const currentExisting =
      role === "model"
        ? listFilmPullModelRefs(currentRefs)
        : listFilmPullProductRefs(currentRefs);
    if (currentExisting.length >= FILM_PULL_REF_MAX_PER_ROLE) break;
    const result = appendFilmPullReference(currentRefs, role, url);
    currentRefs = result.refs;
    addedCount += 1;
  }

  if (addedCount === 0) throw new Error("所选资产不可用");
  return updateEcomFilmPullProject(userId, projectId, { characterRefs: currentRefs });
}

export async function saveFilmPullAnalyzeResult(
  userId: string,
  projectId: string,
  result: FilmPullStructuredResult<FilmPullStoredAnalyze>,
): Promise<FilmPullProjectDto> {
  return updateEcomFilmPullProject(userId, projectId, {
    analyzeResult: result,
    status: result.structured ? "analyzed" : "failed",
  });
}

export async function saveFilmPullRenderScriptResult(
  userId: string,
  projectId: string,
  result: FilmPullStructuredResult<FilmPullRenderScriptPatch>,
): Promise<FilmPullProjectDto> {
  return updateEcomFilmPullProject(userId, projectId, {
    renderScript: result,
    status: result.structured ? "render_ready" : "failed",
  });
}

export async function patchFilmPullAnalyzeShots(
  userId: string,
  projectId: string,
  shots: FilmPullAnalyzePatch["shots"],
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  const structured = project?.analyzeResult?.structured;
  if (!structured) throw new Error("暂无拉片结果");
  if (!isLegacyFilmPullAnalyzePatch(structured)) {
    throw new Error("当前拉片结果为 Pro2 格式，不支持此编辑接口");
  }
  const next: FilmPullAnalyzePatch = { ...structured, shots };
  return updateEcomFilmPullProject(userId, projectId, {
    analyzeResult: {
      ...project.analyzeResult!,
      structured: next,
    },
  });
}

export async function buildRenderPlanFromScript(
  userId: string,
  projectId: string,
  script: FilmPullRenderScriptPatch,
): Promise<FilmPullProjectDto> {
  const plan: FilmPullRenderPlan = {
    shots: script.shots.map((s) => ({
      shotNo: s.shotNo,
      videoPrompt: s.aiVisualPrompt,
      durationSec: s.durationSec,
      voiceover: s.audioInfo.scriptSubtitle !== "无" ? s.audioInfo.scriptSubtitle : "",
    })),
  };
  return updateEcomFilmPullProject(userId, projectId, { renderPlan: plan, status: "render_ready" });
}

export async function updateFilmPullRenderPlanShot(
  userId: string,
  projectId: string,
  shotNo: number,
  patch: Partial<{ videoUrl: string; videoTaskId: string }>,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  const plan = project?.renderPlan;
  if (!plan) throw new Error("暂无渲染计划");
  const shots = plan.shots.map((s) =>
    s.shotNo === shotNo ? { ...s, ...patch } : s,
  );
  return updateEcomFilmPullProject(userId, projectId, { renderPlan: { ...plan, shots } });
}

export async function saveFilmPullRefMatch(
  userId: string,
  projectId: string,
  refMatch: FilmPullRefMatch,
): Promise<FilmPullProjectDto> {
  return updateEcomFilmPullProject(userId, projectId, { refMatch });
}

export async function patchFilmPullRefMatchShot(
  userId: string,
  projectId: string,
  shotNo: number,
  patch: Partial<Pick<FilmPullRefMatch["shots"][number], "modelRefIds" | "productRefIds">>,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  const refMatch = project?.refMatch;
  if (!refMatch) throw new Error("暂无参考图匹配");
  const shots = refMatch.shots.map((s) =>
    s.shotNo === shotNo ? { ...s, ...patch } : s,
  );
  return updateEcomFilmPullProject(userId, projectId, { refMatch: { shots } });
}

export async function confirmFilmPullRefMatch(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project?.refMatch?.shots.length) throw new Error("请先完成参考图匹配");
  return updateEcomFilmPullProject(userId, projectId, {
    meta: { refMatchConfirmedAt: new Date().toISOString() },
  });
}

export async function saveFilmPullProductionPlan(
  userId: string,
  projectId: string,
  productionPlan: FilmPullProductionPlan,
): Promise<FilmPullProjectDto> {
  return updateEcomFilmPullProject(userId, projectId, { productionPlan });
}

export async function patchFilmPullProductionShot(
  userId: string,
  projectId: string,
  shotNo: number,
  patch: Partial<FilmPullProductionShot>,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  const plan = project?.productionPlan;
  if (!plan) throw new Error("暂无制作脚本");
  const shots = plan.shots.map((s) =>
    s.shotNo === shotNo ? { ...s, ...patch } : s,
  );
  return updateEcomFilmPullProject(userId, projectId, { productionPlan: { ...plan, shots } });
}

export async function confirmFilmPullProductionScript(
  userId: string,
  projectId: string,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project?.productionPlan?.shots.length) throw new Error("请先生成制作脚本");
  return updateEcomFilmPullProject(userId, projectId, {
    meta: { productionScriptConfirmedAt: new Date().toISOString() },
  });
}

export async function appendFilmPullChatMessage(
  userId: string,
  projectId: string,
  message: Omit<FilmPullChatMessage, "id" | "createdAt"> & { id?: string },
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  const entry: FilmPullChatMessage = {
    id: message.id ?? randomUUID(),
    role: message.role,
    content: message.content,
    createdAt: new Date().toISOString(),
  };
  return updateEcomFilmPullProject(userId, projectId, {
    chatHistory: [...project.chatHistory, entry],
  });
}

export type { FilmPullAnalyzePatch };
