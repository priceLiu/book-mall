import { NextResponse } from "next/server";

import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadQuickReplicaCatalogAsset } from "@/lib/quick-replica/qr-asset-upload";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const dataUrl = typeof body.dataUrl === "string" ? body.dataUrl : "";
  const catalogKey = typeof body.catalogKey === "string" ? body.catalogKey.trim() : "new";
  const kindRaw = typeof body.kind === "string" ? body.kind : "image";
  const kind = kindRaw === "video" ? "video" : "image";

  if (!dataUrl.trim()) {
    return NextResponse.json({ error: "dataUrl required" }, { status: 400 });
  }

  try {
    const result = await uploadQuickReplicaCatalogAsset({ catalogKey, dataUrl, kind });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
