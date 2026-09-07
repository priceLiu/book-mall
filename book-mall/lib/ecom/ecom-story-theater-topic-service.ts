import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { prisma } from "@/lib/prisma";

export type StoryTheaterVertical = "fashion_apparel" | "bags" | "digital_3c";

export type EcomStoryTheaterTopicEntry = {
  id: string;
  vertical: StoryTheaterVertical;
  title: string;
  storyCore: string;
  storyType: string;
  tags?: string[];
  scope?: EcomCatalogScope;
  userId?: string | null;
  enabled?: boolean;
  sortOrder?: number;
};

function rowToEntry(row: {
  id: string;
  vertical: string;
  title: string;
  storyCore: string;
  storyType: string;
  tags: unknown;
  scope: string;
  userId: string | null;
  enabled: boolean;
  sortOrder: number;
}): EcomStoryTheaterTopicEntry {
  return {
    id: row.id,
    vertical: row.vertical as StoryTheaterVertical,
    title: row.title,
    storyCore: row.storyCore,
    storyType: row.storyType,
    tags: Array.isArray(row.tags)
      ? (row.tags as string[])
      : row.tags && typeof row.tags === "object"
        ? Object.values(row.tags as Record<string, string>)
        : undefined,
    scope: row.scope === "user" ? "user" : "platform",
    userId: row.userId,
    enabled: row.enabled,
    sortOrder: row.sortOrder,
  };
}

export async function listPlatformStoryTheaterTopics(
  vertical: StoryTheaterVertical,
): Promise<EcomStoryTheaterTopicEntry[]> {
  const rows = await prisma.ecomStoryTheaterTopic.findMany({
    where: { deletedAt: null, enabled: true, scope: "platform", vertical },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function listUserStoryTheaterTopics(
  userId: string,
  vertical: StoryTheaterVertical,
): Promise<EcomStoryTheaterTopicEntry[]> {
  const rows = await prisma.ecomStoryTheaterTopic.findMany({
    where: { deletedAt: null, enabled: true, scope: "user", userId, vertical },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(rowToEntry);
}

export async function listAllStoryTheaterTopicsForAdmin(
  vertical?: StoryTheaterVertical,
): Promise<EcomStoryTheaterTopicEntry[]> {
  const rows = await prisma.ecomStoryTheaterTopic.findMany({
    where: {
      deletedAt: null,
      scope: "platform",
      ...(vertical ? { vertical } : {}),
    },
    orderBy: [{ vertical: "asc" }, { sortOrder: "asc" }, { title: "asc" }],
  });
  return rows.map(rowToEntry);
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

export async function sampleStoryTheaterTopics(opts: {
  vertical: StoryTheaterVertical;
  userId?: string;
  count?: number;
  excludeIds?: string[];
}): Promise<EcomStoryTheaterTopicEntry[]> {
  const count = opts.count ?? 5;
  const platform = await listPlatformStoryTheaterTopics(opts.vertical);
  const user = opts.userId
    ? await listUserStoryTheaterTopics(opts.userId, opts.vertical)
    : [];
  const merged = [...platform, ...user];
  const exclude = new Set(opts.excludeIds ?? []);
  const pool = merged.filter((t) => !exclude.has(t.id));
  if (pool.length <= count) return pool;
  return shuffle(pool).slice(0, count);
}

export async function getStoryTheaterTopicById(
  id: string,
): Promise<EcomStoryTheaterTopicEntry | null> {
  const row = await prisma.ecomStoryTheaterTopic.findFirst({
    where: { id, deletedAt: null },
  });
  return row ? rowToEntry(row) : null;
}

export async function upsertStoryTheaterTopic(
  entry: EcomStoryTheaterTopicEntry,
): Promise<EcomStoryTheaterTopicEntry> {
  const data = {
    vertical: entry.vertical,
    title: entry.title,
    storyCore: entry.storyCore,
    storyType: entry.storyType,
    tags: entry.tags ? (entry.tags as Prisma.InputJsonValue) : undefined,
    scope: entry.scope ?? "platform",
    userId: entry.userId ?? null,
    enabled: entry.enabled ?? true,
    sortOrder: entry.sortOrder ?? 0,
    deletedAt: null,
  };
  const row = await prisma.ecomStoryTheaterTopic.upsert({
    where: { id: entry.id },
    create: { id: entry.id, ...data },
    update: data,
  });
  return rowToEntry(row);
}

export type EcomStoryTheaterTopicCatalog = {
  topics: EcomStoryTheaterTopicEntry[];
  platform: EcomStoryTheaterTopicEntry[];
  user: EcomStoryTheaterTopicEntry[];
};

const STORY_THEATER_VERTICALS: StoryTheaterVertical[] = [
  "fashion_apparel",
  "bags",
  "digital_3c",
];

export async function listPlatformStoryTheaterTopicsAll(
  vertical?: StoryTheaterVertical,
): Promise<EcomStoryTheaterTopicEntry[]> {
  const verticals = vertical ? [vertical] : STORY_THEATER_VERTICALS;
  const rows = await Promise.all(verticals.map((v) => listPlatformStoryTheaterTopics(v)));
  return rows.flat();
}

export async function readStoryTheaterCatalogForUser(
  userId: string,
  vertical?: StoryTheaterVertical,
): Promise<EcomStoryTheaterTopicCatalog> {
  const verticals = vertical ? [vertical] : STORY_THEATER_VERTICALS;
  const platform: EcomStoryTheaterTopicEntry[] = [];
  const user: EcomStoryTheaterTopicEntry[] = [];
  for (const v of verticals) {
    platform.push(...(await listPlatformStoryTheaterTopics(v)));
    user.push(...(await listUserStoryTheaterTopics(userId, v)));
  }
  return { topics: [...platform, ...user], platform, user };
}

export async function createUserStoryTheaterTopic(
  userId: string,
  input: Omit<EcomStoryTheaterTopicEntry, "id" | "scope" | "userId"> & { id?: string },
): Promise<EcomStoryTheaterTopicEntry> {
  return upsertStoryTheaterTopic({
    ...input,
    id: input.id ?? `user-story-${randomUUID()}`,
    scope: "user",
    userId,
  });
}

export async function updateUserStoryTheaterTopic(
  userId: string,
  id: string,
  patch: Partial<
    Pick<EcomStoryTheaterTopicEntry, "title" | "storyCore" | "storyType" | "tags" | "vertical">
  >,
): Promise<EcomStoryTheaterTopicEntry> {
  const existing = await getStoryTheaterTopicById(id);
  if (!existing || existing.scope !== "user" || existing.userId !== userId) {
    throw new Error("无权编辑该条目");
  }
  return upsertStoryTheaterTopic({ ...existing, ...patch, scope: "user", userId });
}

export async function deleteUserStoryTheaterTopic(
  userId: string,
  id: string,
): Promise<boolean> {
  const existing = await getStoryTheaterTopicById(id);
  if (!existing || existing.scope !== "user" || existing.userId !== userId) {
    throw new Error("无权删除该条目");
  }
  return deleteStoryTheaterTopic(id);
}

export async function deleteStoryTheaterTopic(id: string): Promise<boolean> {
  const row = await prisma.ecomStoryTheaterTopic.findFirst({
    where: { id, deletedAt: null },
  });
  if (!row) return false;
  await prisma.ecomStoryTheaterTopic.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return true;
}

export function storyTopicChoiceLabel(title: string): string {
  return `选择故事主题：${title}`;
}

export function parseStoryTopicChoice(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("选择故事主题：")) return null;
  return trimmed.slice("选择故事主题：".length).trim() || null;
}

export function storyTheaterVersionChoiceLabel(key: string): string {
  return `选择故事版 ${key}`;
}

export function parseStoryTheaterVersionChoice(message: string): string | null {
  const m = message.trim().match(/^选择故事版\s*(T[1-5])$/);
  return m?.[1] ?? null;
}
