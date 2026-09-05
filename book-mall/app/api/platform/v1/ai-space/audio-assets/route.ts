import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  checkAiSpaceAudioReferences,
  deleteAiSpaceAudioAsset,
  listAiSpaceAudioAssets,
  renameAiSpaceAudioAsset,
} from "@/lib/ai-space/ai-space-audio-service";
import { deleteManagedOssObjectByUrl } from "@/lib/oss-delete-object";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 音频库列表；`maxDurationSec` 供合成台按 20 秒门禁过滤 */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const maxRaw = url.searchParams.get("maxDurationSec");
  const max = maxRaw ? Number.parseFloat(maxRaw) : NaN;
  const checkRefsFor = url.searchParams.get("checkRefsFor")?.trim();

  try {
    if (checkRefsFor) {
      const refs = await checkAiSpaceAudioReferences(auth.actor.userId, checkRefsFor);
      return NextResponse.json({ refs });
    }
    const assets = await listAiSpaceAudioAssets(auth.actor.userId, {
      maxDurationSec: Number.isFinite(max) && max > 0 ? max : undefined,
    });
    return NextResponse.json({ assets });
  } catch (e) {
    console.error("[ai-space/audio-assets] GET failed", e);
    return NextResponse.json({ error: "读取音频库失败" }, { status: 500 });
  }
}

/** 重命名 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  if (!name) return NextResponse.json({ error: "名称不能为空" }, { status: 400 });

  try {
    const ok = await renameAiSpaceAudioAsset(auth.actor.userId, id, name);
    if (!ok) return NextResponse.json({ error: "音频不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/audio-assets] PATCH failed", e);
    return NextResponse.json({ error: "重命名失败" }, { status: 500 });
  }
}

/** 删除音频（前端须已完成二次确认）；仅当无其它记录共用同一 URL 时清 OSS */
export async function DELETE(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  try {
    const res = await deleteAiSpaceAudioAsset(auth.actor.userId, id);
    if (!res.deleted) {
      return NextResponse.json({ error: "音频不存在" }, { status: 404 });
    }
    if (res.audioUrl) {
      const oss = await deleteManagedOssObjectByUrl(res.audioUrl);
      if (!oss.ok) console.warn("[ai-space/audio-assets] OSS 清理失败", oss.error);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[ai-space/audio-assets] DELETE failed", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
