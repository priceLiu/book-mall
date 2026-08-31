import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export type EcomPropLibraryEntry = {
  id: string;
  name: string;
  visualDescription: string;
  conflictTags?: string[];
  ossUrl?: string;
  enabled?: boolean;
  sortOrder?: number;
};

export type EcomPropLibraryCatalog = {
  props: EcomPropLibraryEntry[];
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
    return { props: data.props ?? [] };
  } catch {
    return { props: [] };
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
  enabled: boolean;
  sortOrder: number;
}): EcomPropLibraryEntry {
  return {
    id: row.id,
    name: row.name,
    visualDescription: row.visualDescription,
    conflictTags: parseConflictTags(row.conflictTags),
    ossUrl: row.ossUrl ?? undefined,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listPropLibraryEntriesFromDb(): Promise<EcomPropLibraryEntry[]> {
  try {
    const rows = await prisma.ecomPropLibraryEntry.findMany({
      where: { deletedAt: null, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-prop-library] list from db failed", e);
    return [];
  }
}

export async function listAllPropLibraryEntriesFromDb(): Promise<EcomPropLibraryEntry[]> {
  const rows = await prisma.ecomPropLibraryEntry.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function readPropLibraryCatalogLive(): Promise<EcomPropLibraryCatalog> {
  const fromDb = await listPropLibraryEntriesFromDb();
  if (fromDb.length > 0) return { props: fromDb };
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

export async function getPropLibraryEntry(id: string): Promise<EcomPropLibraryEntry | null> {
  const row = await prisma.ecomPropLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
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
