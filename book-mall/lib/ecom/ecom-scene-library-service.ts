import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";

export type EcomSceneLibraryEntry = {
  id: string;
  name: string;
  visualPrompt: string;
  tags?: Record<string, unknown>;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomSceneLibraryCatalog = {
  scenes: EcomSceneLibraryEntry[];
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
    return { scenes: data.scenes ?? [] };
  } catch {
    return { scenes: [] };
  }
}

function rowToEntry(row: {
  id: string;
  name: string;
  visualPrompt: string;
  tags: unknown;
  enabled: boolean;
  sortOrder: number;
}): EcomSceneLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    visualPrompt: row.visualPrompt,
    tags:
      row.tags && typeof row.tags === "object" && !Array.isArray(row.tags)
        ? (row.tags as Record<string, unknown>)
        : undefined,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listSceneLibraryEntriesFromDb(): Promise<EcomSceneLibraryEntry[]> {
  try {
    const rows = await prisma.ecomSceneLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-scene-library] list from db failed", e);
    return [];
  }
}

export async function listAllSceneLibraryEntriesFromDb(): Promise<EcomSceneLibraryEntry[]> {
  const rows = await prisma.ecomSceneLibraryEntry.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function readSceneLibraryCatalogLive(): Promise<EcomSceneLibraryCatalog> {
  const fromDb = await listSceneLibraryEntriesFromDb();
  if (fromDb.length > 0) return { scenes: fromDb };
  return readSceneLibraryCatalogJson();
}

export async function upsertSceneLibraryEntry(
  entry: EcomSceneLibraryEntry,
): Promise<EcomSceneLibraryEntry> {
  const data = {
    name: entry.name,
    visualPrompt: entry.visualPrompt,
    tags: entry.tags ?? undefined,
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

export async function getSceneLibraryEntry(id: string): Promise<EcomSceneLibraryEntry | null> {
  const row = await prisma.ecomSceneLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
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
