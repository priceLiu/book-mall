import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "crypto";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { assertUserCatalogEditable } from "@/lib/ecom/ecom-catalog-lock";
import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export type EcomPropLibraryEntry = {
  id: string;
  name: string;
  visualDescription: string;
  conflictTags?: string[];
  ossUrl?: string;
  scope?: EcomCatalogScope;
  userId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPropLibraryCatalog = {
  props: EcomPropLibraryEntry[];
  platform?: EcomPropLibraryEntry[];
  user?: EcomPropLibraryEntry[];
};

function catalogPath(): string {
  const env = process.env.ECOM_PROP_LIBRARY_CATALOG_PATH?.trim();
  if (env) return resolve(env);
  const rel = ["e-commerce-toolkit", "lib", "ecom-prop-library", "catalog.json"] as const;
  const candidates = [
    resolve(process.cwd(), "..", ...rel),
    resolve(process.cwd(), ...rel),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

export function readPropLibraryCatalogJson(): EcomPropLibraryCatalog {
  try {
    const raw = readFileSync(catalogPath(), "utf8");
    const data = JSON.parse(raw) as EcomPropLibraryCatalog;
    const props = (data.props ?? []).map((p) => ({ ...p, scope: "platform" as const }));
    return { props, platform: props, user: [] };
  } catch {
    return { props: [], platform: [], user: [] };
  }
}

function parseConflictTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((x): x is string => typeof x === "string");
}

function rowToEntry(row: {
  id: string;
  name: string;
  visualDescription: string;
  conflictTags: unknown;
  ossUrl: string | null;
  scope: string;
  userId: string | null;
  lockedAt: Date | null;
  enabled: boolean;
  sortOrder: number;
}): EcomPropLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    visualDescription: row.visualDescription,
    conflictTags: parseConflictTags(row.conflictTags),
    ossUrl: row.ossUrl ?? undefined,
    scope: row.scope === "user" ? "user" : "platform",
    userId: row.userId,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listPlatformPropEntriesFromDb(): Promise<EcomPropLibraryEntry[]> {
  try {
    const rows = await prisma.ecomPropLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true, scope: "platform" },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-prop-library] list platform from db failed", e);
    return [];
  }
}

export async function listUserPropEntriesFromDb(userId: string): Promise<EcomPropLibraryEntry[]> {
  try {
    const rows = await prisma.ecomPropLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true, scope: "user", userId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-prop-library] list user from db failed", e);
    return [];
  }
}

export async function listPropLibraryEntriesFromDb(): Promise<EcomPropLibraryEntry[]> {
  return listPlatformPropEntriesFromDb();
}

export async function listAllPropLibraryEntriesFromDb(): Promise<EcomPropLibraryEntry[]> {
  const rows = await prisma.ecomPropLibraryEntry.findMany({
    where: { deletedAt: null, scope: "platform" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function readPropLibraryCatalogForUser(
  userId: string,
): Promise<EcomPropLibraryCatalog> {
  const platformDb = await listPlatformPropEntriesFromDb();
  const userDb = await listUserPropEntriesFromDb(userId);
  if (platformDb.length > 0 || userDb.length > 0) {
    return { props: [...platformDb, ...userDb], platform: platformDb, user: userDb };
  }
  const json = readPropLibraryCatalogJson();
  return { ...json, user: userDb };
}

export async function readPropLibraryCatalogLive(): Promise<EcomPropLibraryCatalog> {
  const platform = await listPlatformPropEntriesFromDb();
  if (platform.length > 0) return { props: platform, platform, user: [] };
  return readPropLibraryCatalogJson();
}

export async function upsertPropLibraryEntry(
  entry: EcomPropLibraryEntry,
): Promise<EcomPropLibraryEntry> {
  const data = {
    name: entry.name,
    visualDescription: entry.visualDescription,
    conflictTags: entry.conflictTags ?? undefined,
    ossUrl: entry.ossUrl ?? null,
    scope: entry.scope ?? "platform",
    userId: entry.userId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomPropLibraryEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function createUserPropEntry(
  userId: string,
  input: Omit<EcomPropLibraryEntry, "id" | "scope" | "userId" | "lockedAt"> & { id?: string },
): Promise<EcomPropLibraryEntry> {
  return upsertPropLibraryEntry({
    ...input,
    id: input.id ?? `user-prop-${randomUUID()}`,
    scope: "user",
    userId,
  });
}

export async function updateUserPropEntry(
  userId: string,
  id: string,
  patch: Partial<Omit<EcomPropLibraryEntry, "id" | "scope" | "userId">>,
): Promise<EcomPropLibraryEntry> {
  await assertUserCatalogEditable("prop", id, userId);
  const existing = await getPropLibraryEntry(id);
  if (!existing) throw new Error("条目不存在");
  return upsertPropLibraryEntry({ ...existing, ...patch, scope: "user", userId });
}

export async function getPropLibraryEntry(id: string): Promise<EcomPropLibraryEntry | null> {
  const row = await prisma.ecomPropLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
}

export async function deleteUserPropEntry(userId: string, id: string): Promise<boolean> {
  await assertUserCatalogEditable("prop", id, userId);
  return deletePropLibraryEntry(id, { deleteOss: true });
}

export async function deletePropLibraryEntry(
  id: string,
  opts?: { deleteOss?: boolean },
): Promise<boolean> {
  const row = await prisma.ecomPropLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) return false;
  if (opts?.deleteOss && row.ossUrl) {
    await deleteManagedOssObjectByUrl(row.ossUrl);
  }
  await prisma.ecomPropLibraryEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}
