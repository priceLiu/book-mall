import type {
  Pro2PromptTemplatePassKind,
  Pro2PromptTemplateRegistry,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  type Pro2ActiveTemplatesSnapshot,
  type Pro2HubPromptPackResolved,
  type Pro2PromptBlock,
  type Pro2PromptTemplateRecord,
  type Pro2TemplatePackRecord,
  resolvePro2AssetCompositionFromBlocks,
  resolvePro2ScriptPromptFromBlocks,
} from "./pro2-prompt-template-types";

function parseBlocks(raw: unknown): Pro2PromptBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is Pro2PromptBlock =>
      b != null &&
      typeof b === "object" &&
      typeof (b as Pro2PromptBlock).id === "string" &&
      typeof (b as Pro2PromptBlock).content === "string",
  );
}

function templateRowToRecord(row: {
  id: string;
  registry: Pro2PromptTemplateRegistry;
  passKind: Pro2PromptTemplatePassKind;
  templateKey: string;
  name: string;
  description: string | null;
  version: string;
  enabled: boolean;
  blocks: unknown;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}): Pro2PromptTemplateRecord {
  return {
    id: row.id,
    registry: row.registry,
    passKind: row.passKind,
    templateKey: row.templateKey,
    name: row.name,
    description: row.description,
    version: row.version,
    enabled: row.enabled,
    blocks: parseBlocks(row.blocks),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type PackRow = {
  id: string;
  packKey: string;
  name: string;
  enabled: boolean;
  categoryDocTitle: string | null;
  categoryDocBody: string | null;
  outlineTemplateId: string;
  characterTemplateId: string;
  sceneTemplateId: string;
  storyboardTemplateId: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  outlineTemplate?: Parameters<typeof templateRowToRecord>[0];
  characterTemplate?: Parameters<typeof templateRowToRecord>[0];
  sceneTemplate?: Parameters<typeof templateRowToRecord>[0];
  storyboardTemplate?: Parameters<typeof templateRowToRecord>[0];
};

function packRowToRecord(row: PackRow): Pro2TemplatePackRecord {
  return {
    id: row.id,
    packKey: row.packKey,
    name: row.name,
    enabled: row.enabled,
    categoryDocTitle: row.categoryDocTitle,
    categoryDocBody: row.categoryDocBody,
    outlineTemplateId: row.outlineTemplateId,
    characterTemplateId: row.characterTemplateId,
    sceneTemplateId: row.sceneTemplateId,
    storyboardTemplateId: row.storyboardTemplateId,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.outlineTemplate
      ? { outlineTemplate: templateRowToRecord(row.outlineTemplate) }
      : {}),
    ...(row.characterTemplate
      ? { characterTemplate: templateRowToRecord(row.characterTemplate) }
      : {}),
    ...(row.sceneTemplate
      ? { sceneTemplate: templateRowToRecord(row.sceneTemplate) }
      : {}),
    ...(row.storyboardTemplate
      ? { storyboardTemplate: templateRowToRecord(row.storyboardTemplate) }
      : {}),
  };
}

const activeTemplateWhere = { deletedAt: null as null };
const activePackWhere = { deletedAt: null as null };

export type ListPro2TemplatesFilter = {
  registry?: Pro2PromptTemplateRegistry;
  passKind?: Pro2PromptTemplatePassKind;
  enabled?: boolean;
};

export async function listPro2PromptTemplates(
  filter: ListPro2TemplatesFilter = {},
): Promise<Pro2PromptTemplateRecord[]> {
  const rows = await prisma.pro2PromptTemplate.findMany({
    where: {
      ...activeTemplateWhere,
      ...(filter.registry ? { registry: filter.registry } : {}),
      ...(filter.passKind ? { passKind: filter.passKind } : {}),
      ...(filter.enabled != null ? { enabled: filter.enabled } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { templateKey: "asc" }],
  });
  return rows.map(templateRowToRecord);
}

export async function getPro2PromptTemplateById(
  id: string,
): Promise<Pro2PromptTemplateRecord | null> {
  const row = await prisma.pro2PromptTemplate.findFirst({
    where: { id, ...activeTemplateWhere },
  });
  return row ? templateRowToRecord(row) : null;
}

export type UpsertPro2PromptTemplateInput = {
  registry: Pro2PromptTemplateRegistry;
  passKind: Pro2PromptTemplatePassKind;
  templateKey: string;
  name: string;
  description?: string | null;
  version?: string;
  enabled?: boolean;
  blocks: Pro2PromptBlock[];
  sortOrder?: number;
};

export async function createPro2PromptTemplate(
  input: UpsertPro2PromptTemplateInput,
): Promise<Pro2PromptTemplateRecord> {
  const enabled = input.enabled ?? true;
  if (enabled) {
    await prisma.pro2PromptTemplate.updateMany({
      where: {
        registry: input.registry,
        passKind: input.passKind,
        enabled: true,
        ...activeTemplateWhere,
      },
      data: { enabled: false },
    });
  }
  const row = await prisma.pro2PromptTemplate.create({
    data: {
      registry: input.registry,
      passKind: input.passKind,
      templateKey: input.templateKey,
      name: input.name,
      description: input.description ?? null,
      version: input.version ?? "1",
      enabled,
      blocks: input.blocks,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return templateRowToRecord(row);
}

export async function updatePro2PromptTemplate(
  id: string,
  patch: Partial<Omit<UpsertPro2PromptTemplateInput, "registry" | "passKind" | "templateKey">>,
): Promise<Pro2PromptTemplateRecord | null> {
  const existing = await prisma.pro2PromptTemplate.findFirst({
    where: { id, ...activeTemplateWhere },
  });
  if (!existing) return null;

  if (patch.enabled === true) {
    await prisma.pro2PromptTemplate.updateMany({
      where: {
        registry: existing.registry,
        passKind: existing.passKind,
        enabled: true,
        id: { not: id },
        ...activeTemplateWhere,
      },
      data: { enabled: false },
    });
  }

  const row = await prisma.pro2PromptTemplate.update({
    where: { id },
    data: {
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.version != null ? { version: patch.version } : {}),
      ...(patch.enabled != null ? { enabled: patch.enabled } : {}),
      ...(patch.blocks != null ? { blocks: patch.blocks } : {}),
      ...(patch.sortOrder != null ? { sortOrder: patch.sortOrder } : {}),
    },
  });
  return templateRowToRecord(row);
}

export async function softDeletePro2PromptTemplate(id: string): Promise<boolean> {
  const existing = await prisma.pro2PromptTemplate.findFirst({
    where: { id, ...activeTemplateWhere },
  });
  if (!existing) return false;
  await prisma.pro2PromptTemplate.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false },
  });
  return true;
}

export async function listPro2TemplatePacks(): Promise<Pro2TemplatePackRecord[]> {
  const rows = await prisma.pro2TemplatePack.findMany({
    where: activePackWhere,
    include: {
      outlineTemplate: true,
      characterTemplate: true,
      sceneTemplate: true,
      storyboardTemplate: true,
    },
    orderBy: [{ sortOrder: "asc" }, { packKey: "asc" }],
  });
  return rows.map((r) => packRowToRecord(r as PackRow));
}

export async function getPro2TemplatePackByKey(
  packKey: string,
): Promise<Pro2TemplatePackRecord | null> {
  const row = await prisma.pro2TemplatePack.findFirst({
    where: { packKey, ...activePackWhere },
    include: {
      outlineTemplate: true,
      characterTemplate: true,
      sceneTemplate: true,
      storyboardTemplate: true,
    },
  });
  return row ? packRowToRecord(row as PackRow) : null;
}

export type UpsertPro2TemplatePackInput = {
  packKey: string;
  name: string;
  enabled?: boolean;
  categoryDocTitle?: string | null;
  categoryDocBody?: string | null;
  outlineTemplateId: string;
  characterTemplateId: string;
  sceneTemplateId: string;
  storyboardTemplateId: string;
  sortOrder?: number;
};

export async function createPro2TemplatePack(
  input: UpsertPro2TemplatePackInput,
): Promise<Pro2TemplatePackRecord> {
  const row = await prisma.pro2TemplatePack.create({
    data: {
      packKey: input.packKey,
      name: input.name,
      enabled: input.enabled ?? true,
      categoryDocTitle: input.categoryDocTitle ?? null,
      categoryDocBody: input.categoryDocBody ?? null,
      outlineTemplateId: input.outlineTemplateId,
      characterTemplateId: input.characterTemplateId,
      sceneTemplateId: input.sceneTemplateId,
      storyboardTemplateId: input.storyboardTemplateId,
      sortOrder: input.sortOrder ?? 0,
    },
    include: {
      outlineTemplate: true,
      characterTemplate: true,
      sceneTemplate: true,
      storyboardTemplate: true,
    },
  });
  return packRowToRecord(row as PackRow);
}

export async function updatePro2TemplatePack(
  id: string,
  patch: Partial<Omit<UpsertPro2TemplatePackInput, "packKey">>,
): Promise<Pro2TemplatePackRecord | null> {
  const existing = await prisma.pro2TemplatePack.findFirst({
    where: { id, ...activePackWhere },
  });
  if (!existing) return null;
  const row = await prisma.pro2TemplatePack.update({
    where: { id },
    data: {
      ...(patch.name != null ? { name: patch.name } : {}),
      ...(patch.enabled != null ? { enabled: patch.enabled } : {}),
      ...(patch.categoryDocTitle !== undefined
        ? { categoryDocTitle: patch.categoryDocTitle }
        : {}),
      ...(patch.categoryDocBody !== undefined
        ? { categoryDocBody: patch.categoryDocBody }
        : {}),
      ...(patch.outlineTemplateId != null
        ? { outlineTemplateId: patch.outlineTemplateId }
        : {}),
      ...(patch.characterTemplateId != null
        ? { characterTemplateId: patch.characterTemplateId }
        : {}),
      ...(patch.sceneTemplateId != null
        ? { sceneTemplateId: patch.sceneTemplateId }
        : {}),
      ...(patch.storyboardTemplateId != null
        ? { storyboardTemplateId: patch.storyboardTemplateId }
        : {}),
      ...(patch.sortOrder != null ? { sortOrder: patch.sortOrder } : {}),
    },
    include: {
      outlineTemplate: true,
      characterTemplate: true,
      sceneTemplate: true,
      storyboardTemplate: true,
    },
  });
  return packRowToRecord(row as PackRow);
}

export async function softDeletePro2TemplatePack(id: string): Promise<boolean> {
  const existing = await prisma.pro2TemplatePack.findFirst({
    where: { id, ...activePackWhere },
  });
  if (!existing) return false;
  await prisma.pro2TemplatePack.update({
    where: { id },
    data: { deletedAt: new Date(), enabled: false },
  });
  return true;
}

export async function getActivePro2TemplatesSnapshot(): Promise<Pro2ActiveTemplatesSnapshot> {
  const [packs, scriptTemplates, assetTemplates] = await Promise.all([
    listPro2TemplatePacks(),
    listPro2PromptTemplates({ registry: "SCRIPT", enabled: true }),
    listPro2PromptTemplates({ registry: "ASSET", enabled: true }),
  ]);
  return {
    packs: packs.filter((p) => p.enabled),
    scriptTemplates,
    assetTemplates,
  };
}

export async function resolveActivePro2TemplatePack(
  packKey?: string,
): Promise<Pro2HubPromptPackResolved | null> {
  const key = packKey?.trim() || "default-master";
  const pack = await getPro2TemplatePackByKey(key);
  if (!pack?.enabled) {
    if (key !== "default-master") {
      return resolveActivePro2TemplatePack("default-master");
    }
    return null;
  }

  const [outline, character, scene, storyboard] = await Promise.all([
    prisma.pro2PromptTemplate.findFirst({
      where: { id: pack.outlineTemplateId, ...activeTemplateWhere },
    }),
    prisma.pro2PromptTemplate.findFirst({
      where: { id: pack.characterTemplateId, ...activeTemplateWhere },
    }),
    prisma.pro2PromptTemplate.findFirst({
      where: { id: pack.sceneTemplateId, ...activeTemplateWhere },
    }),
    prisma.pro2PromptTemplate.findFirst({
      where: { id: pack.storyboardTemplateId, ...activeTemplateWhere },
    }),
  ]);

  if (!outline || !character || !scene || !storyboard) return null;

  return {
    packKey: pack.packKey,
    promptOutline: resolvePro2ScriptPromptFromBlocks(parseBlocks(outline.blocks)),
    promptCharacter: resolvePro2ScriptPromptFromBlocks(parseBlocks(character.blocks)),
    promptScene: resolvePro2ScriptPromptFromBlocks(parseBlocks(scene.blocks)),
    promptStoryboard: resolvePro2ScriptPromptFromBlocks(parseBlocks(storyboard.blocks)),
    ...(pack.categoryDocTitle ? { categoryDocTitle: pack.categoryDocTitle } : {}),
    ...(pack.categoryDocBody ? { categoryDocBody: pack.categoryDocBody } : {}),
  };
}

export async function resolveActivePro2AssetTemplate(
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
): Promise<Pro2PromptTemplateRecord | null> {
  const row = await prisma.pro2PromptTemplate.findFirst({
    where: {
      registry: "ASSET",
      passKind,
      enabled: true,
      ...activeTemplateWhere,
    },
    orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
  });
  return row ? templateRowToRecord(row) : null;
}

export async function resolveActivePro2AssetCompositionSpec(
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
): Promise<string | undefined> {
  const tpl = await resolveActivePro2AssetTemplate(passKind);
  if (!tpl) return undefined;
  return resolvePro2AssetCompositionFromBlocks(tpl.blocks);
}
