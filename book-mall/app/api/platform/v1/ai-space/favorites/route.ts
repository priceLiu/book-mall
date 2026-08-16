import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceFavoriteError,
  createAiSpaceFavorite,
  deleteAiSpaceFavorite,
  listAiSpaceFavorites,
} from "@/lib/ai-space/ai-space-favorite-service";
import {
  isAiSpaceFavoriteTargetKind,
  type AiSpaceTtsVoiceFavoriteMeta,
} from "@/lib/ai-space/ai-space-favorite-types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const kindRaw = url.searchParams.get("targetKind")?.trim();
  const targetKind = kindRaw && isAiSpaceFavoriteTargetKind(kindRaw) ? kindRaw : undefined;

  try {
    const favorites = await listAiSpaceFavorites(auth.actor.userId, { targetKind });
    return NextResponse.json({ favorites });
  } catch (e) {
    console.error("[ai-space/favorites] GET failed", e);
    return NextResponse.json({ error: "读取收藏失败" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const targetKind = body.targetKind;
  const targetId = typeof body.targetId === "string" ? body.targetId.trim() : "";
  if (!isAiSpaceFavoriteTargetKind(targetKind) || !targetId) {
    return NextResponse.json({ error: "targetKind / targetId 无效" }, { status: 400 });
  }

  let meta: AiSpaceTtsVoiceFavoriteMeta | null = null;
  if (targetKind === "tts_voice" && body.meta && typeof body.meta === "object") {
    const m = body.meta as Record<string, unknown>;
    if (typeof m.label === "string" && m.label.trim()) {
      meta = {
        label: m.label.trim(),
        language: typeof m.language === "string" ? m.language : null,
        previewUrl: typeof m.previewUrl === "string" ? m.previewUrl : null,
        modelKey: typeof m.modelKey === "string" ? m.modelKey : null,
        avatarLetter: typeof m.avatarLetter === "string" ? m.avatarLetter : null,
      };
    }
  }

  try {
    const result = await createAiSpaceFavorite({
      userId: auth.actor.userId,
      targetKind,
      targetId,
      meta,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof AiSpaceFavoriteError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/favorites] POST failed", e);
    return NextResponse.json({ error: "收藏失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  const targetKindRaw = url.searchParams.get("targetKind")?.trim();
  const targetId = url.searchParams.get("targetId")?.trim();
  const targetKind =
    targetKindRaw && isAiSpaceFavoriteTargetKind(targetKindRaw) ? targetKindRaw : undefined;

  try {
    await deleteAiSpaceFavorite(auth.actor.userId, { id: id || undefined, targetKind, targetId });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AiSpaceFavoriteError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/favorites] DELETE failed", e);
    return NextResponse.json({ error: "取消收藏失败" }, { status: 500 });
  }
}
