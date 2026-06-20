import { NextResponse } from "next/server";

import { listKindBrowseItems } from "@/lib/quick-replica/qr-kind-featured-service";
import { requireQuickReplicaSession } from "@/lib/quick-replica/qr-platform-auth";
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
  const auth = await requireQuickReplicaSession(request);
  if (!auth.ok) return auth.response;

  const category = parseCategory(new URL(request.url).searchParams.get("category"));
  if (!category) {
    return NextResponse.json({ error: "缺少有效 category" }, { status: 400 });
  }

  const kinds = await listKindBrowseItems(auth.userId, category);
  return NextResponse.json({ category, kinds });
}
