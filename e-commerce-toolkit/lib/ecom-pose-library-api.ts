import { listEcomPoseLibraryEntries } from "./ecom-pose-library/catalog";
import type { EcomPoseLibraryCatalog, EcomPoseLibraryEntry } from "./ecom-pose-library/types";

export async function fetchEcomPoseLibraryCatalog(): Promise<EcomPoseLibraryCatalog> {
  try {
    const res = await fetch("/api/book-mall/api/sso/tools/ecom/pose-library/catalog", {
      credentials: "include",
    });
    if (res.ok) {
      return (await res.json()) as EcomPoseLibraryCatalog;
    }
  } catch {
    /* fallback */
  }
  const poses = listEcomPoseLibraryEntries();
  return { poses, platform: poses, user: [] };
}

export async function createEcomPoseLibraryEntry(input: {
  category: string;
  title: string;
  baseDescription: string;
}): Promise<EcomPoseLibraryEntry> {
  const res = await fetch("/api/book-mall/api/sso/tools/ecom/pose-library/entries", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "创建失败");
  }
  const data = (await res.json()) as { entry: EcomPoseLibraryEntry };
  return data.entry;
}

export async function updateEcomPoseLibraryEntry(
  id: string,
  patch: Partial<{ category: string; title: string; baseDescription: string }>,
): Promise<EcomPoseLibraryEntry> {
  const res = await fetch(`/api/book-mall/api/sso/tools/ecom/pose-library/entries/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "更新失败");
  }
  const data = (await res.json()) as { entry: EcomPoseLibraryEntry };
  return data.entry;
}

export async function deleteEcomPoseLibraryEntry(id: string): Promise<void> {
  const res = await fetch(`/api/book-mall/api/sso/tools/ecom/pose-library/entries/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? "删除失败");
  }
}
