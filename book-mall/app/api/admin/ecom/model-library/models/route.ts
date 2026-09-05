import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  readModelLibraryCatalogLive,
  upsertModelLibraryEntry,
  type EcomModelAge,
  type EcomModelGender,
} from "@/lib/ecom/ecom-model-library-service";

export const dynamic = "force-dynamic";

function parseGender(raw: unknown): EcomModelGender | null {
  if (raw === "female" || raw === "male" || raw === "plus_female") return raw;
  return null;
}

function parseAge(raw: unknown): EcomModelAge | null {
  if (raw === "adult" || raw === "child") return raw;
  return null;
}

export async function GET() {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const catalog = await readModelLibraryCatalogLive();
    return NextResponse.json(catalog);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message, models: [] }, { status: 500 });
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
  const gender = parseGender(body.gender);
  const age = parseAge(body.age);
  const ossUrl = typeof body.ossUrl === "string" ? body.ossUrl.trim() : "";
  if (!id || !name || !gender || !age || !ossUrl) {
    return NextResponse.json({ error: "id/name/gender/age/ossUrl 必填" }, { status: 400 });
  }
  const entry = await upsertModelLibraryEntry({
    id,
    name,
    gender,
    age,
    ossUrl,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });
  return NextResponse.json({ entry }, { status: 201 });
}
