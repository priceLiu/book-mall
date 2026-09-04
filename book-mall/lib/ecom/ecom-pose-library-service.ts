import { Prisma } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "crypto";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { assertUserCatalogEditable } from "@/lib/ecom/ecom-catalog-lock";
import { prisma } from "@/lib/prisma";

export type EcomPoseLibraryEntry = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  tags?: Record<string, unknown>;
  scope?: EcomCatalogScope;
  userId?: string | null;
  lockedAt?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPoseLibraryCatalog = {
  poses: EcomPoseLibraryEntry[];
  platform?: EcomPoseLibraryEntry[];
  user?: EcomPoseLibraryEntry[];
};

function catalogPath(): string {
  const env = process.env.ECOM_POSE_LIBRARY_CATALOG_PATH?.trim();
  if (env) return resolve(env);
  const rel = ["e-commerce-toolkit", "lib", "ecom-pose-library", "catalog.json"] as const;
  const candidates = [
    resolve(process.cwd(), "..", ...rel),
    resolve(process.cwd(), ...rel),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

export function readPoseLibraryCatalogJson(): EcomPoseLibraryCatalog {
  try {
    const raw = readFileSync(catalogPath(), "utf8");
    const data = JSON.parse(raw) as EcomPoseLibraryCatalog;
    const poses = (data.poses ?? []).map((p) => ({ ...p, scope: "platform" as const }));
    return { poses, platform: poses, user: [] };
  } catch {
    return { poses: [], platform: [], user: [] };
  }
}

function rowToEntry(row: {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  tags: unknown;
  scope: string;
  userId: string | null;
  lockedAt: Date | null;
  enabled: boolean;
  sortOrder: number;
}): EcomPoseLibraryEntry {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    baseDescription: row.baseDescription,
    tags:
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : undefined,
    scope: row.scope === "user" ? "user" : "platform",
    userId: row.userId,
    lockedAt: row.lockedAt?.toISOString() ?? null,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listPlatformPoseEntriesFromDb(): Promise<EcomPoseLibraryEntry[]> {
  try {
    const rows = await prisma.ecomPoseLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true, scope: "platform" },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-pose-library] list platform from db failed", e);
    return [];
  }
}

export async function listUserPoseEntriesFromDb(userId: string): Promise<EcomPoseLibraryEntry[]> {
  try {
    const rows = await prisma.ecomPoseLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true, scope: "user", userId },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-pose-library] list user from db failed", e);
    return [];
  }
}

export async function listPoseLibraryEntriesFromDb(): Promise<EcomPoseLibraryEntry[]> {
  const platform = await listPlatformPoseEntriesFromDb();
  return platform;
}

export async function listAllPoseLibraryEntriesFromDb(): Promise<EcomPoseLibraryEntry[]> {
  const rows = await prisma.ecomPoseLibraryEntry.findMany({
    where: { deletedAt: null, scope: "platform" },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function readPoseLibraryCatalogForUser(
  userId: string,
): Promise<EcomPoseLibraryCatalog> {
  const platformDb = await listPlatformPoseEntriesFromDb();
  const userDb = await listUserPoseEntriesFromDb(userId);
  if (platformDb.length > 0 || userDb.length > 0) {
    const platform = platformDb;
    const user = userDb;
    return { poses: [...platform, ...user], platform, user };
  }
  const json = readPoseLibraryCatalogJson();
  return { ...json, user: userDb };
}

export async function readPoseLibraryCatalogLive(): Promise<EcomPoseLibraryCatalog> {
  const platform = await listPlatformPoseEntriesFromDb();
  if (platform.length > 0) return { poses: platform, platform, user: [] };
  return readPoseLibraryCatalogJson();
}

export async function upsertPoseLibraryEntry(
  entry: EcomPoseLibraryEntry,
): Promise<EcomPoseLibraryEntry> {
  const data = {
    category: entry.category,
    title: entry.title,
    baseDescription: entry.baseDescription,
    tags: entry.tags ? (entry.tags as Prisma.InputJsonValue) : undefined,
    scope: entry.scope ?? "platform",
    userId: entry.userId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomPoseLibraryEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function createUserPoseEntry(
  userId: string,
  input: Omit<EcomPoseLibraryEntry, "id" | "scope" | "userId" | "lockedAt"> & { id?: string },
): Promise<EcomPoseLibraryEntry> {
  return upsertPoseLibraryEntry({
    ...input,
    id: input.id ?? `user-pose-${randomUUID()}`,
    scope: "user",
    userId,
  });
}

export async function updateUserPoseEntry(
  userId: string,
  id: string,
  patch: Partial<Omit<EcomPoseLibraryEntry, "id" | "scope" | "userId">>,
): Promise<EcomPoseLibraryEntry> {
  await assertUserCatalogEditable("pose", id, userId);
  const existing = await getPoseLibraryEntry(id);
  if (!existing) throw new Error("条目不存在");
  return upsertPoseLibraryEntry({ ...existing, ...patch, scope: "user", userId });
}

export async function getPoseLibraryEntry(id: string): Promise<EcomPoseLibraryEntry | null> {
  const row = await prisma.ecomPoseLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
}

export async function deleteUserPoseEntry(userId: string, id: string): Promise<boolean> {
  await assertUserCatalogEditable("pose", id, userId);
  return deletePoseLibraryEntry(id);
}

export async function deletePoseLibraryEntry(id: string): Promise<boolean> {
  const row = await prisma.ecomPoseLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) return false;
  await prisma.ecomPoseLibraryEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}
