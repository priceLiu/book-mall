import { Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "crypto";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import {
  buildCatalogViewerScopeOr,
  normalizeCatalogScope,
} from "@/lib/ecom/ecom-catalog-viewer-scope";
import { assertUserCatalogEditable } from "@/lib/ecom/ecom-catalog-lock";
import {
  resolveEcomSceneLibraryDisplayImageUrl,
} from "@/lib/ecom/ecom-scene-library-display";
import { tagsForArchetype, type SceneArchetype } from "@/lib/ecom/model-shot/scene-pose-rules";
import { prisma } from "@/lib/prisma";

export type EcomSceneLibraryEntry = {
  id: string;
  name: string;
  visualPrompt: string;
  ossUrl?: string | null;
  thumbUrl?: string | null;
  sourceImageKey?: string | null;
  /** API 聚合字段：展示用缩略图（含平台默认图） */
  displayImageUrl?: string;
  tags?: Record<string, unknown>;
  scope?: EcomCatalogScope;
  userId?: string | null;
  tenantId?: string | null;
  sourceProjectId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomSceneLibraryCatalog = {
  scenes: EcomSceneLibraryEntry[];
  platform?: EcomSceneLibraryEntry[];
  user?: EcomSceneLibraryEntry[];
};

function catalogPath(): string {
  const env = process.env.ECOM_SCENE_LIBRARY_CATALOG_PATH?.trim();
  if (env) return resolve(env);
  const rel = ["e-commerce-toolkit", "lib", "ecom-scene-library", "catalog.json"] as const;
  const candidates = [
    resolve(process.cwd(), "..", ...rel),
    resolve(process.cwd(), ...rel),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

export function readSceneLibraryCatalogJson(): EcomSceneLibraryCatalog {
  try {
    const raw = readFileSync(catalogPath(), "utf8");
    const data = JSON.parse(raw) as EcomSceneLibraryCatalog;
    const scenes = (data.scenes ?? []).map((s) => ({ ...s, scope: "platform" as const }));
    return { scenes, platform: scenes, user: [] };
  } catch {
    return { scenes: [], platform: [], user: [] };
  }
}

function rowToEntry(row: {
  id: string;
  name: string;
  visualPrompt: string;
  ossUrl: string | null;
  thumbUrl: string | null;
  sourceImageKey: string | null;
  tags: unknown;
  scope: string;
  userId: string | null;
  tenantId: string | null;
  sourceProjectId: string | null;
  lockedAt: Date | null;
  enabled: boolean;
  sortOrder: number;
}): EcomSceneLibraryEntry {
  const base: EcomSceneLibraryEntry = {
    id: row.id,
    name: row.name,
    visualPrompt: row.visualPrompt,
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl,
    sourceImageKey: row.sourceImageKey,
    tags:
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : undefined,
    scope: normalizeCatalogScope(row.scope),
    userId: row.userId,
    tenantId: row.tenantId,
    sourceProjectId: row.sourceProjectId,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
  return enrichSceneEntryForClient(base);
}

function enrichSceneEntryForClient(entry: EcomSceneLibraryEntry): EcomSceneLibraryEntry {
  return {
    ...entry,
    displayImageUrl: resolveEcomSceneLibraryDisplayImageUrl(entry),
  };
}

function enrichSceneCatalog(catalog: EcomSceneLibraryCatalog): EcomSceneLibraryCatalog {
  const mapList = (list: EcomSceneLibraryEntry[] | undefined) =>
    (list ?? []).map((e) =>
      e.displayImageUrl ? e : enrichSceneEntryForClient(e),
    );
  const platform = mapList(catalog.platform);
  const user = mapList(catalog.user);
  const scenes = mapList(catalog.scenes.length ? catalog.scenes : [...platform, ...user]);
  return { scenes, platform, user };
}

export async function listPlatformSceneEntriesFromDb(): Promise<EcomSceneLibraryEntry[]> {
  try {
    const rows = await prisma.ecomSceneLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true, scope: "platform" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-scene-library] list platform from db failed", e);
    return [];
  }
}

export async function listUserSceneEntriesFromDb(userId: string): Promise<EcomSceneLibraryEntry[]> {
  try {
    const rows = await prisma.ecomSceneLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true, scope: "user", userId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-scene-library] list user from db failed", e);
    return [];
  }
}

export async function listSceneLibraryEntriesFromDb(): Promise<EcomSceneLibraryEntry[]> {
  return listPlatformSceneEntriesFromDb();
}

export async function listAllSceneLibraryEntriesFromDb(): Promise<EcomSceneLibraryEntry[]> {
  const rows = await prisma.ecomSceneLibraryEntry.findMany({
    where: { deletedAt: null, scope: "platform" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function readSceneLibraryCatalogForUser(
  userId: string,
): Promise<EcomSceneLibraryCatalog> {
  const platformDb = await listPlatformSceneEntriesFromDb();
  const userDb = await listUserSceneEntriesFromDb(userId);
  if (platformDb.length > 0 || userDb.length > 0) {
    return enrichSceneCatalog({
      scenes: [...platformDb, ...userDb],
      platform: platformDb,
      user: userDb,
    });
  }
  const json = readSceneLibraryCatalogJson();
  return enrichSceneCatalog({ ...json, user: userDb });
}

export async function readSceneLibraryCatalogLive(): Promise<EcomSceneLibraryCatalog> {
  const platform = await listPlatformSceneEntriesFromDb();
  if (platform.length > 0) {
    return enrichSceneCatalog({ scenes: platform, platform, user: [] });
  }
  return enrichSceneCatalog(readSceneLibraryCatalogJson());
}

export async function listSceneLibraryEntriesForViewer(args: {
  userId: string;
  tenantId?: string | null;
  projectId?: string | null;
  limit?: number;
}): Promise<EcomSceneLibraryEntry[]> {
  const limit = Math.min(Math.max(args.limit ?? 120, 1), 240);
  const rows = await prisma.ecomSceneLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      OR: buildCatalogViewerScopeOr({
        userId: args.userId,
        tenantId: args.tenantId,
        projectId: args.projectId,
      }),
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map((row) =>
    rowToEntry({
      ...row,
      tenantId: row.tenantId ?? null,
      sourceProjectId: row.sourceProjectId ?? null,
    }),
  );
}

export async function upsertSceneLibraryEntry(
  entry: EcomSceneLibraryEntry,
): Promise<EcomSceneLibraryEntry> {
  const data = {
    name: entry.name,
    visualPrompt: entry.visualPrompt,
    ossUrl: entry.ossUrl ?? null,
    thumbUrl: entry.thumbUrl ?? null,
    sourceImageKey: entry.sourceImageKey ?? null,
    tags: entry.tags ? (entry.tags as Prisma.InputJsonValue) : undefined,
    scope: entry.scope ?? "platform",
    userId: entry.userId ?? null,
    tenantId: entry.tenantId ?? null,
    sourceProjectId: entry.sourceProjectId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomSceneLibraryEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function createUserSceneEntry(
  userId: string,
  input: {
    name: string;
    visualPrompt: string;
    archetype: SceneArchetype;
    id?: string;
    sortOrder?: number;
  },
): Promise<EcomSceneLibraryEntry> {
  return upsertSceneLibraryEntry({
    id: input.id ?? `user-scene-${randomUUID()}`,
    name: input.name,
    visualPrompt: input.visualPrompt,
    tags: tagsForArchetype(input.archetype),
    scope: "user",
    userId,
    sortOrder: input.sortOrder ?? 0,
  });
}

export async function updateUserSceneEntry(
  userId: string,
  id: string,
  patch: Partial<Omit<EcomSceneLibraryEntry, "id" | "scope" | "userId">> & {
    archetype?: SceneArchetype;
  },
): Promise<EcomSceneLibraryEntry> {
  await assertUserCatalogEditable("scene", id, userId);
  const existing = await getSceneLibraryEntry(id);
  if (!existing) throw new Error("条目不存在");
  const tags =
    patch.archetype != null
      ? tagsForArchetype(patch.archetype)
      : patch.tags ?? existing.tags;
  const { archetype: _a, ...rest } = patch;
  return upsertSceneLibraryEntry({
    ...existing,
    ...rest,
    tags,
    scope: "user",
    userId,
  });
}

export async function getSceneLibraryEntry(id: string): Promise<EcomSceneLibraryEntry | null> {
  const row = await prisma.ecomSceneLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
}

export async function deleteUserSceneEntry(userId: string, id: string): Promise<boolean> {
  await assertUserCatalogEditable("scene", id, userId);
  return deleteSceneLibraryEntry(id);
}

export async function deleteSceneLibraryEntry(id: string): Promise<boolean> {
  const row = await prisma.ecomSceneLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) return false;
  await prisma.ecomSceneLibraryEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}
