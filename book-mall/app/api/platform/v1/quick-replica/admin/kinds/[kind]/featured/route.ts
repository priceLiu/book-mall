import { NextResponse } from "next/server";

import {
  clearKindFeatured,
  setKindFeaturedTemplate,
} from "@/lib/quick-replica/qr-kind-featured-service";
import { requireQuickReplicaFinanceAdmin } from "@/lib/quick-replica/qr-platform-auth";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ kind: string }> };

export async function PUT(request: Request, ctx: RouteContext) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  const { kind } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const templateId = typeof body.templateId === "string" ? body.templateId.trim() : "";
  const templateSource =
    body.templateSource === "builtin" || body.templateSource === "user"
      ? body.templateSource
      : null;
  if (!templateId || !templateSource) {
    return NextResponse.json({ error: "templateId / templateSource 必填" }, { status: 400 });
  }

  try {
    const row = await setKindFeaturedTemplate({
      kind,
      templateId,
      templateSource,
      adminUserId: auth.userId,
      makePublic: body.makePublic === true,
    });
    return NextResponse.json({ ok: true, featured: row });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "设置失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, ctx: RouteContext) {
  const auth = await requireQuickReplicaFinanceAdmin(_request);
  if (!auth.ok) return auth.response;

  const { kind } = await ctx.params;
  await clearKindFeatured(kind);
  return NextResponse.json({ ok: true });
}
