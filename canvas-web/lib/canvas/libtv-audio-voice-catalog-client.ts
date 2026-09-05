import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type LibtvVoiceCatalogItem = {
  catalogId?: string;
  voiceId: string;
  label: string;
  subtitle: string;
  language?: string;
  previewUrl?: string;
  tags?: string[];
  avatarLetter: string;
  selectable?: boolean;
};

const CLONED_PATH = "/api/platform/v1/ai-space/voices/cloned";
const VOICES_PATH = "/api/platform/v1/ai-space/voices";

export async function fetchLibtvClonedVoices(
  base: string,
): Promise<LibtvVoiceCatalogItem[]> {
  const { url, init } = resolveBookMallBrowserRequest(base, CLONED_PATH);
  const res = await fetch(url, {
    ...init,
    credentials: init.credentials ?? "include",
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: LibtvVoiceCatalogItem[] };
  return (data.items ?? []).map((item) => ({
    ...item,
    tags: [...(item.tags ?? []), "cloned"],
    selectable: item.selectable !== false,
  }));
}

export async function fetchLibtvVoicePage(
  base: string,
  page: number,
  pageSize: number,
): Promise<{ items: LibtvVoiceCatalogItem[]; hasMore: boolean }> {
  const path = `${VOICES_PATH}?page=${page}&pageSize=${pageSize}`;
  const { url, init } = resolveBookMallBrowserRequest(base, path);
  const res = await fetch(url, {
    ...init,
    credentials: init.credentials ?? "include",
  });
  if (!res.ok) throw new Error(`加载音色失败（${res.status}）`);
  const data = (await res.json()) as {
    items: LibtvVoiceCatalogItem[];
    hasMore: boolean;
  };
  return { items: data.items ?? [], hasMore: data.hasMore === true };
}
