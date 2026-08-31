import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  readPropLibraryCatalogLive,
  listAllPropLibraryEntriesFromDb,
  upsertPropLibraryEntry,
} from "@/lib/ecom/ecom-prop-library-service";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const fromDb = await listAllPropLibraryEntriesFromDb();
    if (fromDb.length > 0) return NextResponse.json({ props: fromDb });
    const catalog = await readPropLibraryCatalogLive();
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, props: [] }, { status: 500 });
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
  const visualDescription =
    typeof body.visualDescription === "string" ? body.visualDescription.trim() : "";
  if (!id || !name || !visualDescription) {
    return NextResponse.json({ error: "id/name/visualDescription 必填" }, { status: 400 });
  }
  const entry = await upsertPropLibraryEntry({
    id,
    name,
    visualDescription,
    conflictTags: Array.isArray(body.conflictTags)
      ? body.conflictTags.filter((x): x is string => typeof x === "string")
      : undefined,
    ossUrl: typeof body.ossUrl === "string" ? body.ossUrl : undefined,
    enabled: body.enabled !== false,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
