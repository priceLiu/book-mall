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
  sanitizeFilmPullRenderPlan,
  sanitizeFilmPullRenderScriptResult,
  sanitizeFilmPullSettings,
  type FilmPullAnalyzePatch,
  type FilmPullCharacterRef,
  type FilmPullChatMessage,
  type FilmPullMediaReference,
  type FilmPullProjectDto,
  type FilmPullRenderPlan,
  type FilmPullSettings,
  type FilmPullStructuredResult,
} from "@/lib/ecom/ecom-film-pull-types";
import { prisma } from "@/lib/prisma";

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
  return row ? rowToDto(row) : null;
}

export async function updateEcomFilmPullProject(
  userId: string,
  projectId: string,
  patch: Partial<{
    title: string;
    status: string;
    settings: FilmPullSettings;
    analyzeResult: FilmPullStructuredResult<FilmPullAnalyzePatch> | null;
    renderScript: FilmPullStructuredResult<FilmPullRenderScriptPatch> | null;
    characterRefs: FilmPullCharacterRef[];
    renderPlan: FilmPullRenderPlan | null;
    chatHistory: FilmPullChatMessage[];
    meta: Record<string, unknown>;
    media: FilmPullMediaReference | null;
  }>,
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const prevSettings = sanitizeFilmPullSettings(existing.settings);
  const nextSettings = patch.settings ? { ...prevSettings, ...patch.settings } : prevSettings;

  let nextMeta: Prisma.InputJsonValue | undefined;
  if (patch.meta !== undefined) {
    const prevMeta = (existing.meta as Record<string, unknown> | null) ?? {};
    const merged: Record<string, unknown> = { ...prevMeta, ...patch.meta };
    for (const [key, value] of Object.entries(patch.meta)) {
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

export async function deleteEcomFilmPullProject(userId: string, projectId: string): Promise<void> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");
  await prisma.ecomFilmPullProject.delete({ where: { id: projectId } });
}

async function setProjectMedia(
  userId: string,
  projectId: string,
  media: FilmPullMediaReference,
): Promise<FilmPullProjectDto> {
  const existing = await getOwnedRow(userId, projectId);
  if (!existing) throw new Error("项目不存在");

  const row = await prisma.ecomFilmPullProject.update({
    where: { id: projectId },
    data: {
      references: media as Prisma.InputJsonValue,
      analyzeResult: Prisma.JsonNull,
      renderScript: Prisma.JsonNull,
      renderPlan: Prisma.JsonNull,
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
  const row = await prisma.ecomFilmPullProject.update({
    where: { id: projectId },
    data: {
      references: Prisma.JsonNull,
      analyzeResult: Prisma.JsonNull,
      renderScript: Prisma.JsonNull,
      renderPlan: Prisma.JsonNull,
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

export async function removeFilmPullCharacterRef(
  userId: string,
  projectId: string,
  refId: string,
): Promise<FilmPullProjectDto> {
  const project = await getEcomFilmPullProject(userId, projectId);
  if (!project) throw new Error("项目不存在");
  return updateEcomFilmPullProject(userId, projectId, {
    characterRefs: project.characterRefs.filter((r) => r.id !== refId),
  });
}

export async function saveFilmPullAnalyzeResult(
  userId: string,
  projectId: string,
  result: FilmPullStructuredResult<FilmPullAnalyzePatch>,
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
  const next = { ...structured, shots };
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
