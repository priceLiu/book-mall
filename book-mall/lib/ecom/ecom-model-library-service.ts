import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { prisma } from "@/lib/prisma";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";

export type EcomModelGender = "female" | "male" | "plus_female";
export type EcomModelAge = "adult" | "child";

export type EcomModelLibraryEntry = {
  id: string;
  name: string;
  gender: EcomModelGender;
  age: EcomModelAge;
  ossUrl: string;
  thumbUrl?: string | null;
  scope?: EcomCatalogScope;
  userId?: string | null;
  tenantId?: string | null;
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
  thumbUrl?: string | null;
  scope?: string;
  userId?: string | null;
  tenantId?: string | null;
  sortOrder: number;
}): EcomModelLibraryEntry {
  const gender = row.gender as EcomModelGender;
  const age = row.age as EcomModelAge;
  const scope =
    row.scope === "user" || row.scope === "team" ? row.scope : "platform";
  return {
    id: row.id,
    name: row.name,
    gender:
      gender === "male" || gender === "plus_female" || gender === "female" ? gender : "female",
    age: age === "child" ? "child" : "adult",
    ossUrl: row.ossUrl,
    thumbUrl: row.thumbUrl ?? null,
    scope,
    userId: row.userId ?? null,
    tenantId: row.tenantId ?? null,
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
      where: { deletedAt: null, enabled: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return rows.map(rowToEntry);
  } catch (e) {
    console.warn("[ecom-model-library] list from db failed", e);
    return [];
  }
}

/** 全局资产库 · 模特头像：平台 + 当前用户（+ 团队预留） */
export async function listModelLibraryEntriesForViewer(args: {
  userId: string;
  tenantId?: string | null;
  gender?: string | null;
  limit?: number;
}): Promise<EcomModelLibraryEntry[]> {
  const limit = Math.min(Math.max(args.limit ?? 120, 1), 240);
  const genderFilter = args.gender?.trim();
  const tenantId = args.tenantId?.trim() || null;

  const orClauses: Array<Record<string, unknown>> = [
    { scope: "platform" },
    { scope: "user", userId: args.userId },
  ];
  if (tenantId) {
    orClauses.push({ scope: "team", tenantId });
  }

  const rows = await prisma.ecomModelLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      OR: orClauses,
      ...(genderFilter ? { gender: genderFilter } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: limit,
  });
  return rows.map(rowToEntry);
}

/** 模特头像 · 性别筛选（女含 plus_female） */
export function buildAvatarLibraryGenderWhere(
  gender?: string | null,
): Record<string, unknown> | undefined {
  const g = gender?.trim();
  if (!g) return undefined;
  if (g === "male") return { gender: "male" };
  if (g === "female") return { gender: { in: ["female", "plus_female"] } };
  return { gender: g };
}

/** 全局资产库 · 模特头像（排除全身；不在 DB 层 take，避免女性占满上限截断男性） */
export async function listAvatarLibraryEntriesForViewer(args: {
  userId: string;
  tenantId?: string | null;
  gender?: string | null;
}): Promise<EcomModelLibraryEntry[]> {
  const tenantId = args.tenantId?.trim() || null;
  const genderWhere = buildAvatarLibraryGenderWhere(args.gender);

  const orClauses: Array<Record<string, unknown>> = [
    { scope: "platform" },
    { scope: "user", userId: args.userId },
  ];
  if (tenantId) {
    orClauses.push({ scope: "team", tenantId });
  }

  const rows = await prisma.ecomModelLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      OR: orClauses,
      NOT: {
        OR: [
          { name: { contains: "全身" } },
          { name: { contains: "full-body", mode: "insensitive" } },
        ],
      },
      ...(genderWhere ?? {}),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return rows.map(rowToEntry);
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
