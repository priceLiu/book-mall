import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  deletePoseLibraryEntry,
  getPoseLibraryEntry,
  upsertPoseLibraryEntry,
} from "@/lib/ecom/ecom-pose-library-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getPoseLibraryEntry(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const saved = await upsertPoseLibraryEntry({
    ...existing,
    category: typeof body.category === "string" ? body.category : existing.category,
    title: typeof body.title === "string" ? body.title : existing.title,
    baseDescription:
      typeof body.baseDescription === "string" ? body.baseDescription : existing.baseDescription,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : existing.sortOrder,
  });
  return NextResponse.json({ entry: saved });
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const ok = await deletePoseLibraryEntry(id);
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
