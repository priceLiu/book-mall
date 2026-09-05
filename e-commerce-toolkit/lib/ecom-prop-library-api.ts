import { listEcomPropLibraryEntries } from "./ecom-prop-library/catalog";
import type { EcomPropLibraryCatalog, EcomPropLibraryEntry } from "./ecom-prop-library/types";

export async function fetchEcomPropLibraryCatalog(): Promise<EcomPropLibraryCatalog> {
  try {
    const res = await fetch("/api/book-mall/api/sso/tools/ecom/prop-library/catalog", {
      credentials: "include",
    });
    if (res.ok) {
      return (await res.json()) as EcomPropLibraryCatalog;
    }
  } catch {
    /* fallback */
  }
  const props = listEcomPropLibraryEntries();
  return { props, platform: props, user: [] };
}

export async function createEcomPropLibraryEntry(input: {
  name: string;
  visualDescription: string;
}): Promise<EcomPropLibraryEntry> {
  const res = await fetch("/api/book-mall/api/sso/tools/ecom/prop-library/entries", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "创建失败");
  }
  const data = (await res.json()) as { entry: EcomPropLibraryEntry };
  return data.entry;
}

export async function updateEcomPropLibraryEntry(
  id: string,
  patch: Partial<{ name: string; visualDescription: string }>,
): Promise<EcomPropLibraryEntry> {
  const res = await fetch(`/api/book-mall/api/sso/tools/ecom/prop-library/entries/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "更新失败");
  }
  const data = (await res.json()) as { entry: EcomPropLibraryEntry };
  return data.entry;
}

export async function deleteEcomPropLibraryEntry(id: string): Promise<void> {
  const res = await fetch(`/api/book-mall/api/sso/tools/ecom/prop-library/entries/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "删除失败");
  }
}
