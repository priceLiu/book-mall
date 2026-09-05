import { listEcomSceneLibraryEntries } from "./ecom-scene-library/catalog";
import type { EcomSceneLibraryCatalog, EcomSceneLibraryEntry } from "./ecom-scene-library/types";

export async function fetchEcomSceneLibraryCatalog(): Promise<EcomSceneLibraryCatalog> {
  try {
    const res = await fetch("/api/book-mall/api/sso/tools/ecom/scene-library/catalog", {
      credentials: "include",
    });
    if (res.ok) {
      return (await res.json()) as EcomSceneLibraryCatalog;
    }
  } catch {
    /* fallback */
  }
  const scenes = listEcomSceneLibraryEntries();
  return { scenes, platform: scenes, user: [] };
}

export async function createEcomSceneLibraryEntry(input: {
  name: string;
  visualPrompt: string;
  archetype: string;
}): Promise<EcomSceneLibraryEntry> {
  const res = await fetch("/api/book-mall/api/sso/tools/ecom/scene-library/entries", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "创建失败");
  }
  const data = (await res.json()) as { entry: EcomSceneLibraryEntry };
  return data.entry;
}

export async function updateEcomSceneLibraryEntry(
  id: string,
  patch: Partial<{ name: string; visualPrompt: string; archetype: string }>,
): Promise<EcomSceneLibraryEntry> {
  const res = await fetch(`/api/book-mall/api/sso/tools/ecom/scene-library/entries/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "更新失败");
  }
  const data = (await res.json()) as { entry: EcomSceneLibraryEntry };
  return data.entry;
}

export async function deleteEcomSceneLibraryEntry(id: string): Promise<void> {
  const res = await fetch(`/api/book-mall/api/sso/tools/ecom/scene-library/entries/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "删除失败");
  }
}
