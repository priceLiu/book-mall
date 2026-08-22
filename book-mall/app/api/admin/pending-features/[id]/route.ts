import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { updateAdminPendingFeature } from "@/lib/admin/pending-feature-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const patch: {
    title?: string;
    description?: string;
    docPath?: string;
    listKind?: "FEATURE" | "PENDING";
    completed?: boolean;
    sortOrder?: number;
  } = {};

  if (typeof b.title === "string") patch.title = b.title;
  if (typeof b.description === "string") patch.description = b.description;
  if (typeof b.docPath === "string") patch.docPath = b.docPath;
  if (b.listKind === "FEATURE" || b.listKind === "PENDING") {
    patch.listKind = b.listKind;
  }
  if (typeof b.completed === "boolean") patch.completed = b.completed;
  if (typeof b.sortOrder === "number") patch.sortOrder = b.sortOrder;

  try {
    const item = await updateAdminPendingFeature(id, patch);
    return NextResponse.json({ item });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "更新失败";
    const status = msg === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function DELETE() {
  return NextResponse.json({ error: "待做功能清单不允许删除" }, { status: 403 });
}
