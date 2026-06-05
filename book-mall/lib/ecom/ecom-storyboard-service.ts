import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildStoryboardStandaloneHtml } from "@/lib/ecom/ecom-storyboard-html";
import type { StoryboardDeliverable } from "@/lib/ecom/ecom-storyboard-deliverable";
import {
  ECOM_STORYBOARD_MODULE,
  sanitizeStoryboardChatMessages,
  sanitizeStoryboardReferences,
  parseStoryboardSheet,
  storyboardSheetSchema,
  type StoryboardChatMessage,
  type StoryboardReference,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";

export type EcomStoryboardProjectDto = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  references: StoryboardReference[];
  chatHistory: StoryboardChatMessage[];
  sheet: StoryboardSheet | null;
  sheetPngUrl: string | null;
  sheetHtmlUrl: string | null;
  videoAssetId: string | null;
  videoOssUrl: string | null;
  meta: {
    deliverable?: StoryboardDeliverable;
    deliverableMarkdown?: string;
    selectedSchemeIndex?: number;
    workflow?: {
      phase?: string;
      imageModelKey?: string;
      videoModelKey?: string;
      autoGenCharacter?: boolean;
    };
  } | null;
  createdAt: string;
  updatedAt: string;
};

function rowToDto(
  row: {
    id: string;
    title: string | null;
    module: string;
    status: string;
    brief: unknown;
    settings: unknown;
    references: unknown;
    chatHistory: unknown;
    sheet: unknown;
    sheetPngUrl: string | null;
    sheetHtmlUrl: string | null;
    videoAssetId: string | null;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
  },
  videoOssUrl?: string | null,
): EcomStoryboardProjectDto {
  let sheet: StoryboardSheet | null = null;
  const parsed = storyboardSheetSchema.safeParse(row.sheet);
  if (parsed.success) sheet = parsed.data;

  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: (row.settings as Record<string, unknown> | null) ?? null,
    references: sanitizeStoryboardReferences(row.references),
    chatHistory: sanitizeStoryboardChatMessages(row.chatHistory),
    sheet,
    sheetPngUrl: row.sheetPngUrl,
    sheetHtmlUrl: row.sheetHtmlUrl,
    videoAssetId: row.videoAssetId,
    videoOssUrl: videoOssUrl ?? null,
    meta: (row.meta as EcomStoryboardProjectDto["meta"]) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEcomStoryboardProjects(
  userId: string,
): Promise<EcomStoryboardProjectDto[]> {
  const rows = await prisma.ecomStoryboardProject.findMany({
    where: { userId, module: ECOM_STORYBOARD_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map((row) => rowToDto(row));
}

export async function createEcomStoryboardProject(
  userId: string,
  opts?: { title?: string; brief?: Record<string, unknown> },
): Promise<EcomStoryboardProjectDto> {
  const row = await prisma.ecomStoryboardProject.create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "微剧情分镜",
      brief: (opts?.brief ?? {}) as Prisma.InputJsonValue,
      references: [] as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      settings: {
        durationSec: 10,
        aspectRatio: "9:16",
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

async function loadVideoOssUrlMap(
  userId: string,
  assetIds: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const ids = [...new Set(assetIds.filter((id): id is string => Boolean(id?.trim())))];
  if (ids.length === 0) return new Map();
  const assets = await prisma.ecomAsset.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true, ossUrl: true },
  });
  const map = new Map<string, string>();
  for (const a of assets) {
    const url = a.ossUrl?.trim();
    if (url && /^https?:\/\//.test(url)) map.set(a.id, url);
  }
  return map;
}

export async function getEcomStoryboardProject(
  userId: string,
  projectId: string,
): Promise<EcomStoryboardProjectDto | null> {
  const row = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  const videoMap = await loadVideoOssUrlMap(userId, [row.videoAssetId]);
  return rowToDto(row, row.videoAssetId ? videoMap.get(row.videoAssetId) ?? null : null);
}

export async function updateEcomStoryboardProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    brief?: Record<string, unknown>;
    settings?: Record<string, unknown>;
    references?: StoryboardReference[];
    chatHistory?: StoryboardChatMessage[];
    sheet?: StoryboardSheet | null;
    status?: string;
    sheetPngUrl?: string | null;
    meta?: Record<string, unknown>;
  },
): Promise<EcomStoryboardProjectDto> {
  const existing = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!existing) throw new Error("项目不存在");

  const data: Prisma.EcomStoryboardProjectUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.slice(0, 120);
  if (patch.brief !== undefined) data.brief = patch.brief as Prisma.InputJsonValue;
  if (patch.settings !== undefined) data.settings = patch.settings as Prisma.InputJsonValue;
  if (patch.references !== undefined) {
    data.references = sanitizeStoryboardReferences(patch.references) as Prisma.InputJsonValue;
  }
  if (patch.chatHistory !== undefined) {
    data.chatHistory = sanitizeStoryboardChatMessages(patch.chatHistory) as Prisma.InputJsonValue;
  }
  if (patch.sheet !== undefined) {
    if (patch.sheet === null) {
      data.sheet = Prisma.JsonNull;
    } else {
      data.sheet = parseStoryboardSheet(patch.sheet) as Prisma.InputJsonValue;
      data.status = patch.status ?? "sheet_ready";
    }
  }
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.sheetPngUrl !== undefined) data.sheetPngUrl = patch.sheetPngUrl;
  if (patch.meta !== undefined) {
    const prev = (existing.meta as Record<string, unknown> | null) ?? {};
    data.meta = { ...prev, ...patch.meta } as Prisma.InputJsonValue;
  }

  const row = await prisma.ecomStoryboardProject.update({
    where: { id: projectId },
    data,
  });
  return rowToDto(row);
}

export async function deleteEcomStoryboardProject(
  userId: string,
  projectId: string,
): Promise<void> {
  const row = await prisma.ecomStoryboardProject.findFirst({
    where: { id: projectId, userId },
  });
  if (!row) throw new Error("项目不存在");
  await prisma.ecomStoryboardProject.delete({ where: { id: projectId } });
}

export async function addStoryboardReferenceUpload(
  userId: string,
  projectId: string,
  opts: { label: string; role: StoryboardReference["role"]; buf: Buffer },
): Promise<StoryboardReference> {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project) throw new Error("项目不存在");

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf: opts.buf,
    contentType: "image/png",
  });

  const ref: StoryboardReference = {
    id: `ref-${Date.now()}`,
    label: opts.label.slice(0, 40) || "参考图",
    role: opts.role,
    ossUrl,
  };
  const refs = [...project.references, ref];
  await updateEcomStoryboardProject(userId, projectId, { references: refs });
  return ref;
}

export async function saveStoryboardSheetPng(
  userId: string,
  projectId: string,
  buf: Buffer,
): Promise<string> {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project?.sheet) throw new Error("请先生成分镜故事版");

  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "png",
    buf,
    contentType: "image/png",
  });

  await updateEcomStoryboardProject(userId, projectId, {
    sheetPngUrl: ossUrl,
    status: "sheet_ready",
  });
  return ossUrl;
}

export async function exportStoryboardHtml(
  userId: string,
  projectId: string,
): Promise<{ html: string; ossUrl: string }> {
  const project = await getEcomStoryboardProject(userId, projectId);
  if (!project?.sheet) throw new Error("暂无分镜数据");

  const html = buildStoryboardStandaloneHtml(project.sheet, project.references);
  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    ext: "html",
    buf: Buffer.from(html, "utf-8"),
    contentType: "text/html; charset=utf-8",
  });

  await prisma.ecomStoryboardProject.update({
    where: { id: projectId },
    data: { sheetHtmlUrl: ossUrl },
  });

  return { html, ossUrl };
}
