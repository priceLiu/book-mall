import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  buildStoryboardReusePayload,
  findStoryboardSnapshotInProjectMeta,
} from "@/lib/ecom/ecom-library-service";
import { ECOM_STORYBOARD_MODULE } from "@/lib/ecom/ecom-storyboard-types";
import {
  getEcomStoryboardProject,
  type EcomStoryboardProjectDto,
} from "@/lib/ecom/ecom-storyboard-service";
import {
  sanitizeStoryboardReferences,
  storyboardSheetSchema,
  parseStoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import type { StoryboardDeliverableSnapshot } from "@/lib/ecom/ecom-storyboard-snapshot";

function rowToDto(row: {
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
}): EcomStoryboardProjectDto {
  let sheet = null;
  const parsed = storyboardSheetSchema.safeParse(row.sheet);
  if (parsed.success) sheet = parseStoryboardSheet(parsed.data);
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    brief: (row.brief as Record<string, unknown> | null) ?? null,
    settings: (row.settings as Record<string, unknown> | null) ?? null,
    references: sanitizeStoryboardReferences(row.references),
    chatHistory: [],
    sheet,
    sheetPngUrl: row.sheetPngUrl,
    sheetHtmlUrl: row.sheetHtmlUrl,
    videoAssetId: row.videoAssetId,
    videoOssUrl: null,
    meta: (row.meta as EcomStoryboardProjectDto["meta"]) ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** 从交付快照创建新项目，供「一键复用」 */
export async function createStoryboardProjectFromSnapshot(
  userId: string,
  snap: StoryboardDeliverableSnapshot,
  deliverableMarkdown?: string,
): Promise<EcomStoryboardProjectDto> {
  const payload = buildStoryboardReusePayload(snap, deliverableMarkdown);
  const row = await prisma.ecomStoryboardProject.create({
    data: {
      userId,
      title: payload.title.slice(0, 120),
      module: ECOM_STORYBOARD_MODULE,
      status: "draft",
      brief: {} as Prisma.InputJsonValue,
      references: payload.references as Prisma.InputJsonValue,
      chatHistory: [] as Prisma.InputJsonValue,
      sheet: payload.sheet as Prisma.InputJsonValue,
      sheetPngUrl: snap.sheetPngUrl?.trim() || null,
      settings: {
        durationSec: 15,
        aspectRatio: "9:16",
      } as Prisma.InputJsonValue,
      meta: {
        ...payload.meta,
        workflow: { phase: "finalized" },
      } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

/** 打开已有项目，或将历史快照复用到新项目 */
export async function reuseStoryboardLibraryItem(
  userId: string,
  projectId: string,
  savedAt?: string,
): Promise<EcomStoryboardProjectDto> {
  const source = await getEcomStoryboardProject(userId, projectId);
  if (!source) {
    throw new Error("项目不存在");
  }

  if (!savedAt) {
    return source;
  }

  const latest = source.meta as
    | (EcomStoryboardProjectDto["meta"] & {
        deliverableSnapshot?: StoryboardDeliverableSnapshot;
      })
    | null;
  if (savedAt === latest?.deliverableSnapshot?.savedAt) {
    return source;
  }

  const meta = source.meta as Record<string, unknown> | null;
  const snap = findStoryboardSnapshotInProjectMeta(meta, savedAt);
  if (!snap) {
    throw new Error("找不到该版本快照");
  }

  const markdown =
    typeof meta?.deliverableMarkdown === "string" ? meta.deliverableMarkdown : undefined;
  return createStoryboardProjectFromSnapshot(userId, snap, markdown);
}
