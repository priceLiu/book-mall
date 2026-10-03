import { prisma } from "@/lib/prisma";
import { ECOM_GENERATION_RECORD_MODULE } from "@/lib/ecom/ecom-generation-record";

export type EcomPromptLibraryItem = {
  id: string;
  kind: "image" | "video";
  module: string;
  title: string | null;
  prompt: string;
  ossUrl: string;
  thumbnailUrl: string | null;
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  modelKey: string | null;
};

export type ListEcomPromptLibraryOpts = {
  take?: number;
  kind?: "image" | "video" | "all";
  q?: string;
};

function readMetaString(meta: unknown, key: string): string | null {
  if (!meta || typeof meta !== "object") return null;
  const v = (meta as Record<string, unknown>)[key];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function rowToItem(row: {
  id: string;
  module: string;
  kind: string;
  title: string | null;
  prompt: string | null;
  ossUrl: string;
  thumbnailUrl: string | null;
  createdAt: Date;
  meta: unknown;
}): EcomPromptLibraryItem | null {
  const prompt = row.prompt?.trim() ?? "";
  if (!prompt) return null;
  const meta = row.meta;
  const sourceModule =
    row.module === ECOM_GENERATION_RECORD_MODULE
      ? readMetaString(meta, "sourceModule") ?? row.module
      : row.module;
  return {
    id: row.id,
    kind: row.kind === "video" ? "video" : "image",
    module: sourceModule,
    title: row.title,
    prompt,
    ossUrl: row.ossUrl,
    thumbnailUrl: row.thumbnailUrl,
    createdAt: row.createdAt.toISOString(),
    projectId: readMetaString(meta, "projectId"),
    projectName: readMetaString(meta, "projectName"),
    modelKey: readMetaString(meta, "modelKey"),
  };
}

/** 提示词库：成图/成片与 prompt 一对一（同 ossUrl 去重，优先业务 module 条目） */
export async function listEcomPromptLibrary(
  userId: string,
  opts: ListEcomPromptLibraryOpts = {},
): Promise<EcomPromptLibraryItem[]> {
  const take = Math.min(Math.max(opts.take ?? 200, 1), 500);
  const kind = opts.kind ?? "all";
  const q = opts.q?.trim().toLowerCase() ?? "";

  const rows = await prisma.ecomAsset.findMany({
    where: {
      userId,
      prompt: { not: null },
      ...(kind === "all" ? {} : { kind }),
    },
    orderBy: { createdAt: "desc" },
    take: 1200,
    select: {
      id: true,
      module: true,
      kind: true,
      title: true,
      prompt: true,
      ossUrl: true,
      thumbnailUrl: true,
      createdAt: true,
      meta: true,
    },
  });

  const byUrl = new Map<string, EcomPromptLibraryItem>();
  for (const row of rows) {
    const item = rowToItem(row);
    if (!item) continue;
    const url = item.ossUrl.trim();
    if (!url) continue;
    if (q && !item.prompt.toLowerCase().includes(q) && !(item.title?.toLowerCase().includes(q) ?? false)) {
      continue;
    }
    const existing = byUrl.get(url);
    if (!existing) {
      byUrl.set(url, item);
      continue;
    }
    const preferNew =
      existing.module === ECOM_GENERATION_RECORD_MODULE && item.module !== ECOM_GENERATION_RECORD_MODULE;
    if (preferNew) byUrl.set(url, item);
  }

  const items = [...byUrl.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, take);
}
