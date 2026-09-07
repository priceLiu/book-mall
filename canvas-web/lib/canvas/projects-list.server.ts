/**
 * 我的画布列表 · RSC 首屏预取（需 tools_token cookie）。
 */
import { cookies } from "next/headers";

import type { CanvasProjectListPage } from "@/lib/canvas-api";
import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import { getBookMallOrigin } from "@/lib/site-config";

const DEFAULT_LIMIT = 15;

export async function fetchProjectsListServer(
  limit = DEFAULT_LIMIT,
): Promise<CanvasProjectListPage | null> {
  const token = cookies().get("tools_token")?.value?.trim();
  if (!token) return null;

  const base = getBookMallBaseUrlServer() || getBookMallOrigin();
  if (!base) return null;

  try {
    const url = `${base.replace(/\/$/, "")}/api/canvas/projects?limit=${limit}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as CanvasProjectListPage;
    return {
      projects: Array.isArray(data.projects) ? data.projects : [],
      nextCursor: data.nextCursor ?? null,
      hasMore: Boolean(data.hasMore),
    };
  } catch {
    return null;
  }
}
