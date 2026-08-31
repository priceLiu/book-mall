import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import {
  deletePropLibraryEntry,
  getPropLibraryEntry,
  upsertPropLibraryEntry,
} from "@/lib/ecom/ecom-prop-library-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;
  const existing = await getPropLibraryEntry(id);
  if (!existing) return NextResponse.json({ error: "不存在" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const saved = await upsertPropLibraryEntry({
    ...existing,
    name: typeof body.name === "string" ? body.name : existing.name,
    visualDescription:
      typeof body.visualDescription === "string"
        ? body.visualDescription
        : existing.visualDescription,
    ossUrl: typeof body.ossUrl === "string" ? body.ossUrl : existing.ossUrl,
    enabled: typeof body.enabled === "boolean" ? body.enabled : existing.enabled,
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
  const ok = await deletePropLibraryEntry(id, { deleteOss });
  if (!ok) return NextResponse.json({ error: "不存在" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
