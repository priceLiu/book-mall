import { NextResponse } from "next/server";

import {
  deleteAdminUserQrTemplate,
  listAdminUserQrTemplates,
} from "@/lib/quick-replica/qr-template-service";
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

  const templates = await listAdminUserQrTemplates({ category, kind });
  return NextResponse.json({ templates });
}

export async function DELETE(request: Request) {
  const auth = await requireQuickReplicaFinanceAdmin(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  }

  const ok = await deleteAdminUserQrTemplate(id);
  if (!ok) {
    return NextResponse.json({ error: "作品不存在" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
