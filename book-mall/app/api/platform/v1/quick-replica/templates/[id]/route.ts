import { NextResponse } from "next/server";

import { parseQrWorkspaceDraft } from "@/lib/quick-replica/parse-qr-workspace-draft";
import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
import {
  getQrTemplateById,
  updateUserQrTemplate,
  deleteUserQrTemplate,
} from "@/lib/quick-replica/qr-template-service";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const template = await getQrTemplateById(auth.userId, id);
  if (!template) {
    return NextResponse.json({ error: "模板不存在" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function PUT(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const draft = parseQrWorkspaceDraft(body);
  if (!draft) {
    return NextResponse.json({ error: "无效的草稿数据" }, { status: 400 });
  }

  const template = await updateUserQrTemplate({
    userId: auth.userId,
    id,
    draft,
  });
  if (!template) {
    return NextResponse.json({ error: "作品不存在或无权编辑" }, { status: 404 });
  }
  return NextResponse.json({ template });
}

export async function DELETE(request: Request, ctx: Ctx) {
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const ok = await deleteUserQrTemplate(auth.userId, id);
  if (!ok) {
    return NextResponse.json({ error: "作品不存在或无权删除" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
