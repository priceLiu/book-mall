import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  readSceneLibraryCatalogLive,
  listAllSceneLibraryEntriesFromDb,
  upsertSceneLibraryEntry,
} from "@/lib/ecom/ecom-scene-library-service";
import { tagsForArchetype, isSceneArchetype } from "@/lib/ecom/model-shot/scene-pose-rules";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const fromDb = await listAllSceneLibraryEntriesFromDb();
    if (fromDb.length > 0) return NextResponse.json({ scenes: fromDb });
    const catalog = await readSceneLibraryCatalogLive();
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, scenes: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const visualPrompt = typeof body.visualPrompt === "string" ? body.visualPrompt.trim() : "";
  if (!id || !name || !visualPrompt) {
    return NextResponse.json({ error: "id/name/visualPrompt 必填" }, { status: 400 });
  }
  const tags =
    body.tags && typeof body.tags === "object" && !Array.isArray(body.tags)
      ? (body.tags as Record<string, unknown>)
      : typeof body.archetype === "string" && isSceneArchetype(body.archetype)
        ? tagsForArchetype(body.archetype)
        : undefined;
  const entry = await upsertSceneLibraryEntry({
    id,
    name,
    visualPrompt,
    tags,
    enabled: body.enabled !== false,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
