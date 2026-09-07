import type { StoryTheaterVertical } from "@/lib/story-theater-types";

export type EcomStoryTheaterTopicEntry = {
  id: string;
  vertical: StoryTheaterVertical;
  title: string;
  storyCore: string;
  storyType: string;
  tags?: string[];
  scope?: "platform" | "user";
};

export type EcomStoryTheaterTopicCatalog = {
  topics: EcomStoryTheaterTopicEntry[];
  platform: EcomStoryTheaterTopicEntry[];
  user: EcomStoryTheaterTopicEntry[];
};

export const STORY_THEATER_VERTICAL_LABELS: Record<StoryTheaterVertical, string> = {
  fashion_apparel: "服装",
  bags: "包包",
  digital_3c: "3C 数码",
};

export const STORY_THEATER_STORY_TYPES = [
  "痛点治愈",
  "场景适配",
  "前后反差",
  "经验避坑",
  "情绪共鸣",
] as const;

export async function fetchEcomStoryTheaterTopicCatalog(
  vertical?: StoryTheaterVertical,
): Promise<EcomStoryTheaterTopicCatalog> {
  const qs = vertical ? `?vertical=${encodeURIComponent(vertical)}` : "";
  const res = await fetch(
    `/api/book-mall/api/sso/tools/ecom/storyboard/story-theater/topics/catalog${qs}`,
    { credentials: "include" },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "加载失败");
  }
  return (await res.json()) as EcomStoryTheaterTopicCatalog;
}

export async function createEcomStoryTheaterTopicEntry(input: {
  vertical: StoryTheaterVertical;
  title: string;
  storyCore: string;
  storyType: string;
  tags?: string[];
}): Promise<EcomStoryTheaterTopicEntry> {
  const res = await fetch(
    "/api/book-mall/api/sso/tools/ecom/storyboard/story-theater/topics/entries",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "创建失败");
  }
  const data = (await res.json()) as { entry: EcomStoryTheaterTopicEntry };
  return data.entry;
}

export async function updateEcomStoryTheaterTopicEntry(
  id: string,
  patch: Partial<{
    vertical: StoryTheaterVertical;
    title: string;
    storyCore: string;
    storyType: string;
    tags: string[];
  }>,
): Promise<EcomStoryTheaterTopicEntry> {
  const res = await fetch(
    `/api/book-mall/api/sso/tools/ecom/storyboard/story-theater/topics/entries/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "更新失败");
  }
  const data = (await res.json()) as { entry: EcomStoryTheaterTopicEntry };
  return data.entry;
}

export async function deleteEcomStoryTheaterTopicEntry(id: string): Promise<void> {
  const res = await fetch(
    `/api/book-mall/api/sso/tools/ecom/storyboard/story-theater/topics/entries/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "删除失败");
  }
}
