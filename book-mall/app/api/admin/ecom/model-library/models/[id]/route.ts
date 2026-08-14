import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  deleteModelLibraryEntry,
  getModelLibraryEntry,
  upsertModelLibraryEntry,
  type EcomModelAge,
  type EcomModelGender,
} from "@/lib/ecom/ecom-model-library-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getModelLibraryEntry(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const gender =
    body.gender === "female" || body.gender === "male" || body.gender === "plus_female"
      ? (body.gender as EcomModelGender)
      : existing.gender;
  const age = body.age === "adult" || body.age === "child" ? (body.age as EcomModelAge) : existing.age;

  const saved = await upsertModelLibraryEntry({
    ...existing,
    name: typeof body.name === "string" ? body.name : existing.name,
    gender,
    age,
    ossUrl: typeof body.ossUrl === "string" ? body.ossUrl : existing.ossUrl,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : existing.sortOrder,
  });
  return NextResponse.json({ entry: saved });
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const deleteOss = url.searchParams.get("deleteOss") !== "0";
  const ok = await deleteModelLibraryEntry(id, { deleteOss });
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
