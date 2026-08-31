import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  readPoseLibraryCatalogLive,
  listAllPoseLibraryEntriesFromDb,
  upsertPoseLibraryEntry,
} from "@/lib/ecom/ecom-pose-library-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const fromDb = await listAllPoseLibraryEntriesFromDb();
    if (fromDb.length > 0) return NextResponse.json({ poses: fromDb });
    const catalog = await readPoseLibraryCatalogLive();
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, poses: [] }, { status: 500 });
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
  const category = typeof body.category === "string" ? body.category.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const baseDescription =
    typeof body.baseDescription === "string" ? body.baseDescription.trim() : "";
  if (!id || !category || !title || !baseDescription) {
    return NextResponse.json({ error: "id/category/title/baseDescription 必填" }, { status: 400 });
  }
  const entry = await upsertPoseLibraryEntry({
    id,
    category,
    title,
    baseDescription,
    tags: body.tags && typeof body.tags === "object" ? (body.tags as Record<string, unknown>) : undefined,
    enabled: body.enabled !== false,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
