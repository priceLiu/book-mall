import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AiSpaceComposeError,
  createAiSpaceComposeTask,
  getAiSpaceComposeTask,
  listAiSpaceComposeTasks,
  pumpAiSpaceComposeQueue,
} from "@/lib/ai-space/ai-space-compose-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** 列表 / 单条。轮询时顺带推进队列（S2V 厂商并发 1，无常驻 worker） */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();

  try {
    await pumpAiSpaceComposeQueue().catch((e) =>
      console.warn("[ai-space/compose-tasks] pump failed", e),
    );
    if (id) {
      const task = await getAiSpaceComposeTask(auth.actor.userId, id);
      if (!task) return NextResponse.json({ error: "任务不存在" }, { status: 404 });
      return NextResponse.json({ task });
    }
    const tasks = await listAiSpaceComposeTasks(auth.actor.userId);
    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("[ai-space/compose-tasks] GET failed", e);
    return NextResponse.json({ error: "读取合成任务失败" }, { status: 500 });
  }
}

/** 建合成任务：形象 + 音频（< 20 秒）+ 可选背景视频 */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const digitalHumanId =
    typeof body.digitalHumanId === "string" ? body.digitalHumanId.trim() : "";
  const audioAssetId =
    typeof body.audioAssetId === "string" ? body.audioAssetId.trim() : "";
  if (!digitalHumanId) {
    return NextResponse.json({ error: "请选择数字人形象" }, { status: 400 });
  }
  if (!audioAssetId) {
    return NextResponse.json({ error: "请选择口播音频" }, { status: 400 });
  }

  try {
    const task = await createAiSpaceComposeTask({
      userId: auth.actor.userId,
      tenantId: auth.actor.tenantCtx?.tenantId ?? null,
      digitalHumanId,
      audioAssetId,
      videoMaterialId:
        typeof body.videoMaterialId === "string" && body.videoMaterialId.trim()
          ? body.videoMaterialId.trim()
          : null,
      options: body.options,
    });
    return NextResponse.json({ ok: true, task });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AiSpaceComposeError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/compose-tasks] POST failed", e);
    const msg = e instanceof Error ? e.message : "创建合成任务失败";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
