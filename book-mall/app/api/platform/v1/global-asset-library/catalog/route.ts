import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  listGlobalAssetCatalog,
  type GlobalAssetCatalogKind,
} from "@/lib/ecom/ecom-global-asset-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readKind(raw: string | null): GlobalAssetCatalogKind | "all" {
  if (
    raw === "pose" ||
    raw === "avatar" ||
    raw === "garment" ||
    raw === "full-body"
  ) {
    return raw;
  }
  return "all";
}

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit"));

  try {
    const page = await listGlobalAssetCatalog({
      userId: auth.actor.userId,
      tenantId: url.searchParams.get("tenantId"),
      kind: readKind(url.searchParams.get("kind")),
      gender: url.searchParams.get("gender"),
      keyword: url.searchParams.get("keyword"),
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    });
    return NextResponse.json(page);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
