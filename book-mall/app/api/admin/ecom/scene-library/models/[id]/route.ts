import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  deleteSceneLibraryEntry,
  getSceneLibraryEntry,
  upsertSceneLibraryEntry,
} from "@/lib/ecom/ecom-scene-library-service";
import { tagsForArchetype, isSceneArchetype } from "@/lib/ecom/model-shot/scene-pose-rules";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getSceneLibraryEntry(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const tags =
    typeof body.archetype === "string" && isSceneArchetype(body.archetype)
      ? tagsForArchetype(body.archetype)
      : body.tags && typeof body.tags === "object" && !Array.isArray(body.tags)
        ? (body.tags as Record<string, unknown>)
        : existing.tags;

  const saved = await upsertSceneLibraryEntry({
    ...existing,
    name: typeof body.name === "string" ? body.name : existing.name,
    visualPrompt: typeof body.visualPrompt === "string" ? body.visualPrompt : existing.visualPrompt,
    tags,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : existing.sortOrder,
  });
  return NextResponse.json({ entry: saved });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const ok = await deleteSceneLibraryEntry(id);
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
