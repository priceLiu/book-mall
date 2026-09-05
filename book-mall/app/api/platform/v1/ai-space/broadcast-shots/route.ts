import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceBroadcastError,
  listBroadcastShots,
  updateBroadcastShot,
} from "@/lib/ai-space/ai-space-broadcast-service";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const scriptId = new URL(req.url).searchParams.get("scriptId")?.trim();
  if (!scriptId) {
    return NextResponse.json({ error: "缺少 scriptId" }, { status: 400 });
  }
  try {
    const shots = await listBroadcastShots(auth.actor.userId, scriptId);
    return NextResponse.json({ shots });
  } catch (e) {
    console.error("[ai-space/broadcast-shots] GET failed", e);
    return NextResponse.json({ error: "读取失败" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }
  try {
    const shot = await updateBroadcastShot(auth.actor.userId, id, {
      voiceoverText:
        typeof body.voiceoverText === "string" ? body.voiceoverText : undefined,
      sceneDescription:
        typeof body.sceneDescription === "string"
          ? body.sceneDescription
          : undefined,
      durationSec:
        typeof body.durationSec === "number" ? body.durationSec : undefined,
      presenter:
        body.presenter && typeof body.presenter === "object"
          ? (body.presenter as Record<string, unknown>)
          : undefined,
      visual:
        body.visual && typeof body.visual === "object"
          ? (body.visual as Record<string, unknown>)
          : undefined,
      backgroundVideoId:
        body.backgroundVideoId === null
          ? null
          : typeof body.backgroundVideoId === "string"
            ? body.backgroundVideoId
            : undefined,
      digitalHumanId:
        body.digitalHumanId === null
          ? null
          : typeof body.digitalHumanId === "string"
            ? body.digitalHumanId
            : undefined,
      audioAssetId:
        body.audioAssetId === null
          ? null
          : typeof body.audioAssetId === "string"
            ? body.audioAssetId
            : undefined,
    });
    if (!shot) {
      return NextResponse.json({ error: "分镜不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, shot });
  } catch (e) {
    if (e instanceof AiSpaceBroadcastError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/broadcast-shots] PATCH failed", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
