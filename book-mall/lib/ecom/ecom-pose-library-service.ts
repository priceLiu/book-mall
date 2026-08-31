import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";

export type EcomPoseLibraryEntry = {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  tags?: Record<string, unknown>;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPoseLibraryCatalog = {
  poses: EcomPoseLibraryEntry[];
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
    return { poses: data.poses ?? [] };
  } catch {
    return { poses: [] };
  }
}

function rowToEntry(row: {
  id: string;
  category: string;
  title: string;
  baseDescription: string;
  tags: unknown;
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
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listPoseLibraryEntriesFromDb(): Promise<EcomPoseLibraryEntry[]> {
  try {
    const rows = await prisma.ecomPoseLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-pose-library] list from db failed", e);
    return [];
  }
}

export async function listAllPoseLibraryEntriesFromDb(): Promise<EcomPoseLibraryEntry[]> {
  const rows = await prisma.ecomPoseLibraryEntry.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function readPoseLibraryCatalogLive(): Promise<EcomPoseLibraryCatalog> {
  const fromDb = await listPoseLibraryEntriesFromDb();
  if (fromDb.length > 0) return { poses: fromDb };
  return readPoseLibraryCatalogJson();
}

export async function upsertPoseLibraryEntry(
  entry: EcomPoseLibraryEntry,
): Promise<EcomPoseLibraryEntry> {
  const data = {
    category: entry.category,
    title: entry.title,
    baseDescription: entry.baseDescription,
    tags: entry.tags ?? undefined,
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

export async function getPoseLibraryEntry(id: string): Promise<EcomPoseLibraryEntry | null> {
  const row = await prisma.ecomPoseLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
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
