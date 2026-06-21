import { NextResponse } from "next/server";

import {
  deleteAdminQrTemplate,
  upsertAdminQrTemplate,
} from "@/lib/quick-replica/qr-template-admin-service";
import { requireQuickReplicaFinanceAdmin } from "@/lib/quick-replica/qr-platform-auth";
import type { QrCategory } from "@/lib/quick-replica/qr-types";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

function parseCategory(raw: unknown): QrCategory | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim() as QrCategory;
  if (v === "video" || v === "image" || v === "character" || v === "world" || v === "audio") {
    return v;
  }
  return null;
}

export async function PUT(request: Request, ctx: RouteContext) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = parseCategory(body.category);
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : "";
  const promptText = typeof body.promptText === "string" ? body.promptText.trim() : "";
  const dbId = typeof body.dbId === "string" ? body.dbId.trim() : null;
  const catalogBuiltinId =
    typeof body.catalogBuiltinId === "string"
      ? body.catalogBuiltinId.trim()
      : body.source === "builtin"
        ? id
        : null;

  if (!category || !kind || !title || !thumbnailUrl || !promptText) {
    return NextResponse.json(
      { error: "category/kind/title/thumbnailUrl/promptText 必填" },
      { status: 400 },
    );
  }

  try {
    const template = await upsertAdminQrTemplate({
      adminUserId: auth.userId,
      dbId,
      catalogBuiltinId,
      category,
      kind,
      toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
      title,
      thumbnailUrl,
      promptText,
      mediaUrl: typeof body.mediaUrl === "string" ? body.mediaUrl : undefined,
      modelKey: typeof body.modelKey === "string" ? body.modelKey : undefined,
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });
    return NextResponse.json({ template });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "保存失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const url = new URL(request.url);
  const dbId = url.searchParams.get("dbId")?.trim() || id;

  try {
    await deleteAdminQrTemplate(dbId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "删除失败" },
      { status: 400 },
    );
  }
}
