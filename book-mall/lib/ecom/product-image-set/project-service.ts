import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { prisma } from "@/lib/prisma";

import { parseMeta, parseOutput, parseSettings, sanitizeReferences } from "./parse";
import {
  DEFAULT_PRODUCT_IMAGE_SET_SETTINGS,
  ECOM_PRODUCT_IMAGE_SET_MODULE,
  PRODUCT_IMAGE_SET_MAX_PRODUCT_REFS,
  type ProductImageSetMeta,
  type ProductImageSetOutput,
  type ProductImageSetProject,
  type ProductImageSetReference,
  type ProductImageSetSettings,
} from "./types";

type Row = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  settings: unknown;
  references: unknown;
  output: unknown;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: Row): ProductImageSetProject {
  return {
    id: row.id,
    title: row.title,
    module: row.module,
    status: row.status,
    settings: parseSettings(row.settings),
    references: sanitizeReferences(row.references),
    output: parseOutput(row.output),
    meta: parseMeta(row.meta),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function projects() {
  const d = prisma.ecomProductImageSetProject;
  if (!d) {
    throw new Error(
      "Prisma 未包含 EcomProductImageSetProject，请在 book-mall 执行 pnpm db:generate 并 db:apply-pending",
    );
  }
  return d;
}

export async function listProductImageSetProjects(userId: string): Promise<ProductImageSetProject[]> {
  const rows = await projects().findMany({
    where: { userId, module: ECOM_PRODUCT_IMAGE_SET_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });
  return rows.map(rowToDto);
}

export async function listProductImageSetSummaries(userId: string) {
  const rows = await projects().findMany({
    where: { userId, module: ECOM_PRODUCT_IMAGE_SET_MODULE },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, title: true, updatedAt: true, references: true, output: true },
  });
  return rows.map((row) => {
    const refs = sanitizeReferences(row.references);
    const out = parseOutput(row.output);
    const thumb =
      out.slots.find((s) => s.imageUrl)?.imageUrl ?? refs[0]?.ossUrl ?? null;
    return {
      id: row.id,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
      thumbnailUrl: thumb,
    };
  });
}

export async function createProductImageSetProject(
  userId: string,
  opts?: { title?: string },
): Promise<ProductImageSetProject> {
  const row = await projects().create({
    data: {
      userId,
      title: opts?.title?.trim().slice(0, 120) || "AI 商品套图",
      settings: DEFAULT_PRODUCT_IMAGE_SET_SETTINGS as unknown as Prisma.InputJsonValue,
      references: [] as Prisma.InputJsonValue,
      output: { slots: [] } as Prisma.InputJsonValue,
      meta: { phase: "setup" } as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

const BUSY_STALE_MS = 4 * 60 * 1000;

async function reconcileStaleProductImageSetBusy(
  userId: string,
  dto: ProductImageSetProject,
): Promise<ProductImageSetProject> {
  if (dto.status !== "planning" && dto.status !== "generating") return dto;
  const startedRaw = dto.meta.planStartedAt ?? dto.meta.genStartedAt;
  const startedMs = startedRaw
    ? new Date(startedRaw).getTime()
    : new Date(dto.updatedAt).getTime();
  if (Date.now() - startedMs < BUSY_STALE_MS) return dto;

  const phase =
    dto.output.slots.length > 0
      ? dto.output.slots.some((s) => s.imageUrl?.trim())
        ? ("done" as const)
        : ("planned" as const)
      : ("setup" as const);

  const fixed =
    (await updateProductImageSetProject(userId, dto.id, {
      status: "draft",
      meta: {
        phase,
        planStartedAt: null,
        genStartedAt: null,
        lastBusyStaleAt: new Date().toISOString(),
      },
    })) ?? dto;
  return fixed;
}

/** 批次 bug 或请求中断后，项目已非 generating 但槽位仍卡在 generating */
function reconcileOrphanSlotGenerating(dto: ProductImageSetProject): ProductImageSetProject {
  const projectBusy =
    dto.status === "planning" ||
    dto.status === "generating" ||
    dto.meta.phase === "planning" ||
    dto.meta.phase === "generating";
  if (projectBusy) return dto;

  let dirty = false;
  const slots = dto.output.slots.map((s) => {
    if (s.status === "generating" && !s.imageUrl?.trim()) {
      dirty = true;
      return {
        ...s,
        status: "pending" as const,
        failMessage: s.failMessage ?? undefined,
      };
    }
    return s;
  });
  if (!dirty) return dto;
  return { ...dto, output: { ...dto.output, slots } };
}

export async function getProductImageSetProject(
  userId: string,
  projectId: string,
): Promise<ProductImageSetProject | null> {
  const row = await projects().findFirst({
    where: { id: projectId, userId },
  });
  if (!row) return null;
  const dto = rowToDto(row);
  const afterStale = await reconcileStaleProductImageSetBusy(userId, dto);
  return reconcileOrphanSlotGenerating(afterStale);
}

export async function updateProductImageSetProject(
  userId: string,
  projectId: string,
  patch: {
    title?: string;
    status?: string;
    settings?: Partial<ProductImageSetSettings>;
    references?: ProductImageSetReference[];
    output?: ProductImageSetOutput;
    meta?: Partial<{ [K in keyof ProductImageSetMeta]: ProductImageSetMeta[K] | null }>;
  },
): Promise<ProductImageSetProject | null> {
  const existing = await getProductImageSetProject(userId, projectId);
  if (!existing) return null;

  const settings = patch.settings
    ? { ...existing.settings, ...patch.settings }
    : existing.settings;
  const meta = patch.meta ? { ...existing.meta, ...patch.meta } : existing.meta;
  if (patch.meta) {
    for (const [key, val] of Object.entries(patch.meta)) {
      if (val === null) {
        delete (meta as Record<string, unknown>)[key];
      }
    }
  }
  const output = patch.output ?? existing.output;

  const row = await projects().update({
    where: { id: projectId },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.slice(0, 120) } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      settings: settings as unknown as Prisma.InputJsonValue,
      ...(patch.references ? { references: patch.references as unknown as Prisma.InputJsonValue } : {}),
      output: output as unknown as Prisma.InputJsonValue,
      meta: meta as unknown as Prisma.InputJsonValue,
    },
  });
  return rowToDto(row);
}

export async function uploadProductImageSetRef(
  userId: string,
  projectId: string,
  file: Buffer,
  mime: string,
  label: string,
): Promise<ProductImageSetProject | null> {
  const project = await getProductImageSetProject(userId, projectId);
  if (!project) return null;
  const refs = [...project.references];
  if (refs.length >= PRODUCT_IMAGE_SET_MAX_PRODUCT_REFS) {
    throw new Error(`最多上传 ${PRODUCT_IMAGE_SET_MAX_PRODUCT_REFS} 张商品原图`);
  }
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    buf: file,
    contentType: mime || "image/jpeg",
    ext,
  });
  const next: ProductImageSetReference = {
    id: randomUUID(),
    label: label.slice(0, 40) || "产品图",
    role: "product",
    ossUrl,
    sortIndex: refs.length,
  };
  refs.push(next);
  return updateProductImageSetProject(userId, projectId, { references: refs });
}

export async function removeProductImageSetRef(
  userId: string,
  projectId: string,
  refId: string,
): Promise<ProductImageSetProject | null> {
  const project = await getProductImageSetProject(userId, projectId);
  if (!project) return null;
  const refs = project.references
    .filter((r) => r.id !== refId)
    .map((r, i) => ({ ...r, sortIndex: i }));
  return updateProductImageSetProject(userId, projectId, { references: refs });
}

export async function uploadProductImageSetLayoutRef(
  userId: string,
  projectId: string,
  file: Buffer,
  mime: string,
  label?: string,
): Promise<ProductImageSetProject | null> {
  const project = await getProductImageSetProject(userId, projectId);
  if (!project) return null;
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const ossUrl = await uploadCanvasUserBuffer({
    userId,
    buf: file,
    contentType: mime || "image/jpeg",
    ext,
  });
  const userLayoutRefs = [...project.settings.userLayoutRefs];
  userLayoutRefs.push({
    id: randomUUID(),
    ossUrl,
    label: label?.slice(0, 40),
  });
  return updateProductImageSetProject(userId, projectId, {
    settings: { userLayoutRefs },
  });
}
