/**
 * 全局资产库聚合读
 *
 * `GET ?kind=image&source=ecom_asset&source=story_character&keyword=猫&perSource=24`
 *
 * 与 `pins` 的区别：本路由 **不要求** 资产已收进空间，直接扫各应用源表。
 */

import { NextResponse } from "next/server";

import {
  AI_SPACE_LIBRARY_SOURCE_OPTIONS,
  listAiSpaceLibraryAssets,
} from "@/lib/ai-space/ai-space-asset-library";
import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  isAiSpacePinSourceType,
  type AiSpacePinMediaKind,
  type AiSpacePinSourceType,
} from "@/lib/ai-space/ai-space-pin-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function readKind(raw: string | null): AiSpacePinMediaKind | "all" {
  return raw === "image" || raw === "video" || raw === "audio" ? raw : "all";
}

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const sources = url.searchParams
    .getAll("source")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(isAiSpacePinSourceType) as AiSpacePinSourceType[];

  const perSourceRaw = Number(url.searchParams.get("perSource"));

  try {
    const page = await listAiSpaceLibraryAssets(auth.actor.userId, {
      kind: readKind(url.searchParams.get("kind")),
      sources,
      keyword: url.searchParams.get("keyword"),
      perSource: Number.isFinite(perSourceRaw) ? perSourceRaw : undefined,
    });
    return NextResponse.json({ ...page, sourceOptions: AI_SPACE_LIBRARY_SOURCE_OPTIONS });
  } catch (e) {
    console.error("[ai-space/assets] GET failed", e);
    return NextResponse.json({ error: "读取资产库失败" }, { status: 500 });
  }
}
