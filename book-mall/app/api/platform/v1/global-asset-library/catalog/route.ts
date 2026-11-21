import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  listGlobalAssetCatalog,
  type GlobalAssetCatalogKind,
} from "@/lib/ecom/ecom-global-asset-catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CATALOG_KIND_PARAMS = new Set<GlobalAssetCatalogKind>([
  "pose",
  "avatar",
  "character",
  "garment",
  "full-body",
  "style",
  "scene",
  "reference",
  "prop",
  "storyboard-image",
  "storyboard-video",
  "audio",
]);

function readKind(raw: string | null): GlobalAssetCatalogKind | "all" {
  if (raw && CATALOG_KIND_PARAMS.has(raw as GlobalAssetCatalogKind)) {
    return raw as GlobalAssetCatalogKind;
  }
  return "all";
}

function readCountsKinds(raw: string | null): GlobalAssetCatalogKind[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is GlobalAssetCatalogKind =>
      CATALOG_KIND_PARAMS.has(s as GlobalAssetCatalogKind),
    );
}

function readMediaFilter(
  raw: string | null,
): "all" | "prompt" | "image" | undefined {
  if (raw === "prompt" || raw === "image") return raw;
  return undefined;
}

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit"));
  const offsetRaw = Number(url.searchParams.get("offset"));

  try {
    const audience = url.searchParams.get("audience");
    const platformOnly =
      url.searchParams.get("platformOnly") === "1" ||
      audience === "platform-hub";
    const sharedOnly =
      url.searchParams.get("sharedOnly") === "1" ||
      url.searchParams.get("platformOnly") === "0";

    const page = await listGlobalAssetCatalog({
      userId: auth.actor.userId,
      tenantId: url.searchParams.get("tenantId"),
      projectId: url.searchParams.get("projectId"),
      kind: readKind(url.searchParams.get("kind")),
      gender: url.searchParams.get("gender"),
      keyword: url.searchParams.get("keyword"),
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
      offset: Number.isFinite(offsetRaw) ? offsetRaw : undefined,
      countsScope: url.searchParams.get("countsScope") === "all" ? "all" : "none",
      countsKinds: readCountsKinds(url.searchParams.get("countsKinds")),
      mediaFilter: readMediaFilter(url.searchParams.get("mediaFilter")) ?? "all",
      poseCategory: url.searchParams.get("poseCategory"),
      platformOnly,
      sharedOnly: platformOnly ? false : sharedOnly,
    });
    return NextResponse.json(page);
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
