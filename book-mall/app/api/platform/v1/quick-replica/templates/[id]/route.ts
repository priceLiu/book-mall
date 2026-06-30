import { NextResponse } from "next/server";

import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
import {
  getQrTemplateById,
  updateUserQrTemplate,
  deleteUserQrTemplate,
} from "@/lib/quick-replica/qr-template-service";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseDraft(body: Record<string, unknown>): QrWorkspaceDraft | null {
  const category = body.category;
  const kind = body.kind;
  if (
    category !== "video" &&
    category !== "image" &&
    category !== "character" &&
    category !== "world" &&
    category !== "audio"
  ) {
    return null;
  }
  if (typeof kind !== "string" || !kind.trim()) return null;
  return {
    category,
    kind: kind.trim(),
    toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
    title: typeof body.title === "string" ? body.title : undefined,
    savedTemplateId: typeof body.savedTemplateId === "string" ? body.savedTemplateId : undefined,
    targetImageUrl: typeof body.targetImageUrl === "string" ? body.targetImageUrl : "",
    referenceVideoUrl: typeof body.referenceVideoUrl === "string" ? body.referenceVideoUrl : "",
    referenceAudioUrl: typeof body.referenceAudioUrl === "string" ? body.referenceAudioUrl : "",
    sceneImageUrls: Array.isArray(body.sceneImageUrls)
      ? body.sceneImageUrls.filter((v): v is string => typeof v === "string")
      : [],
    prompt: typeof body.prompt === "string" ? body.prompt : "",
    modelKey: typeof body.modelKey === "string" ? body.modelKey : "lib-nano-pro",
    mode: typeof body.mode === "string" ? body.mode : undefined,
  };
}

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

  const draft = parseDraft(body);
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
