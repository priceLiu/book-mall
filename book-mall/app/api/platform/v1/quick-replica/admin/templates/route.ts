import { NextResponse } from "next/server";

import {
  listAdminQrTemplates,
  upsertAdminQrTemplate,
} from "@/lib/quick-replica/qr-template-admin-service";
import { requireQuickReplicaFinanceAdmin } from "@/lib/quick-replica/qr-platform-auth";
import type { QrCategory } from "@/lib/quick-replica/qr-types";

export const dynamic = "force-dynamic";

function parseCategory(raw: string | null): QrCategory | null {
  if (!raw) return null;
  const v = raw.trim() as QrCategory;
  if (v === "video" || v === "image" || v === "character" || v === "world" || v === "audio") {
    return v;
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const category = parseCategory(url.searchParams.get("category"));
  const kind = url.searchParams.get("kind")?.trim() || null;

  const templates = await listAdminQrTemplates({ category, kind });
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const category = parseCategory(typeof body.category === "string" ? body.category : null);
  const kind = typeof body.kind === "string" ? body.kind.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const thumbnailUrl = typeof body.thumbnailUrl === "string" ? body.thumbnailUrl.trim() : "";
  const promptText = typeof body.promptText === "string" ? body.promptText.trim() : "";

  if (!category || !kind || !title || !thumbnailUrl || !promptText) {
    return NextResponse.json(
      { error: "category/kind/title/thumbnailUrl/promptText 必填" },
      { status: 400 },
    );
  }

  try {
    const template = await upsertAdminQrTemplate({
      adminUserId: auth.userId,
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
    return NextResponse.json({ template }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "创建失败" },
      { status: 400 },
    );
  }
}
