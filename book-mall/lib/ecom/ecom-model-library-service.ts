import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export type EcomModelGender = "female" | "male" | "plus_female";
export type EcomModelAge = "adult" | "child";

export type EcomModelLibraryEntry = {
  id: string;
  name: string;
  gender: EcomModelGender;
  age: EcomModelAge;
  ossUrl: string;
  sortOrder?: number;
};

export type EcomModelLibraryCatalog = {
  models: EcomModelLibraryEntry[];
};

function catalogPath(): string {
  const env = process.env.ECOM_MODEL_LIBRARY_CATALOG_PATH?.trim();
  if (env) return resolve(env);
  const rel = ["e-commerce-toolkit", "lib", "ecom-model-library", "catalog.json"] as const;
  const candidates = [
    resolve(process.cwd(), "..", ...rel),
    resolve(process.cwd(), ...rel),
  ];
  return candidates.find((p) => existsSync(p)) ?? candidates[0]!;
}

export function readModelLibraryCatalogJson(): EcomModelLibraryCatalog {
  try {
    const raw = readFileSync(catalogPath(), "utf8");
    const data = JSON.parse(raw) as EcomModelLibraryCatalog;
    return { models: data.models ?? [] };
  } catch {
    return { models: [] };
  }
}

function rowToEntry(row: {
  id: string;
  name: string;
  gender: string;
  age: string;
  ossUrl: string;
  sortOrder: number;
}): EcomModelLibraryEntry {
  const gender = row.gender as EcomModelGender;
  const age = row.age as EcomModelAge;
  return {
    id: row.id,
    name: row.name,
    gender:
      gender === "male" || gender === "plus_female" || gender === "female" ? gender : "female",
    age: age === "child" ? "child" : "adult",
    ossUrl: row.ossUrl,
    sortOrder: row.sortOrder,
  };
}

function modelDelegate() {
  return (
    prisma as unknown as {
      ecomModelLibraryEntry?: {
        findMany: typeof prisma.ecomModelLibraryEntry.findMany;
      };
    }
  ).ecomModelLibraryEntry;
}

export async function listModelLibraryEntriesFromDb(): Promise<EcomModelLibraryEntry[]> {
  const delegate = modelDelegate();
  if (!delegate) return [];
  try {
    const rows = await delegate.findMany({
      where: { deletedAt: null },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-model-library] list from db failed", e);
    return [];
  }
}

export async function readModelLibraryCatalogLive(): Promise<EcomModelLibraryCatalog> {
  const fromDb = await listModelLibraryEntriesFromDb();
  if (fromDb.length > 0) return { models: fromDb };
  return readModelLibraryCatalogJson();
}

export async function upsertModelLibraryEntry(
  entry: EcomModelLibraryEntry,
): Promise<EcomModelLibraryEntry> {
  const data = {
    name: entry.name,
    gender: entry.gender,
    age: entry.age,
    ossUrl: entry.ossUrl,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomModelLibraryEntry.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export async function getModelLibraryEntry(id: string): Promise<EcomModelLibraryEntry | null> {
  const row = await prisma.ecomModelLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
}

export async function deleteModelLibraryEntry(
  id: string,
  opts?: { deleteOss?: boolean },
): Promise<boolean> {
  const row = await prisma.ecomModelLibraryEntry.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) return false;
  if (opts?.deleteOss) {
    await deleteManagedOssObjectByUrl(row.ossUrl);
  }
  await prisma.ecomModelLibraryEntry.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}
