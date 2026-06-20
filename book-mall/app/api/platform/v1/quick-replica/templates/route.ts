import { NextResponse } from "next/server";

import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
import {
  createUserQrTemplate,
  listQrTemplates,
} from "@/lib/quick-replica/qr-template-service";
import type { QrCategory, QrTemplateJson } from "@/lib/quick-replica/qr-types";

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
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const category = parseCategory(url.searchParams.get("category"));
  const kind = url.searchParams.get("kind")?.trim() || null;
  const toolKey = url.searchParams.get("toolKey")?.trim() || null;
  const scopeRaw = url.searchParams.get("scope")?.trim();
  const scope = scopeRaw === "my" ? "my" : "all";

  const templates = await listQrTemplates(auth.userId, { category, kind, toolKey, scope });
  return NextResponse.json({ templates, scope });
}

export async function POST(request: Request) {
  const auth = await requireQuickReplicaSession(request);
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
  const reference = body.reference as QrTemplateJson["reference"] | undefined;

  if (!category || !kind || !title || !thumbnailUrl || !reference) {
    return NextResponse.json({ error: "category/kind/title/thumbnailUrl/reference 必填" }, { status: 400 });
  }

  const template = await createUserQrTemplate({
    userId: auth.userId,
    category,
    kind,
    toolKey: typeof body.toolKey === "string" ? body.toolKey : undefined,
    title,
    thumbnailUrl,
    reference,
    output: body.output as QrTemplateJson["output"] | undefined,
    gatewayRequestLogId:
      typeof body.gatewayRequestLogId === "string" ? body.gatewayRequestLogId : undefined,
    sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
  });

  return NextResponse.json({ template }, { status: 201 });
}
