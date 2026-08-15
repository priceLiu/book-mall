import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  AI_SPACE_TTS_MODELS,
  isAiSpaceTtsModelKey,
} from "@/lib/ai-space/ai-space-tts-catalog";
import {
  AiSpaceTtsError,
  generateAiSpaceTtsAudio,
} from "@/lib/ai-space/ai-space-tts-service";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** 可选模型与音色（界面渲染用） */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;
  return NextResponse.json({ models: AI_SPACE_TTS_MODELS });
}

/** 生成口播音频并入库 */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  const modelKey = typeof body.modelKey === "string" ? body.modelKey.trim() : "";
  if (!isAiSpaceTtsModelKey(modelKey)) {
    return NextResponse.json({ error: "不支持的语音模型" }, { status: 400 });
  }

  try {
    const asset = await generateAiSpaceTtsAudio({
      userId: auth.actor.userId,
      modelKey,
      voice: typeof body.voice === "string" ? body.voice : "",
      text: typeof body.text === "string" ? body.text : "",
      name: typeof body.name === "string" ? body.name : null,
      instruction: typeof body.instruction === "string" ? body.instruction : null,
    });
    return NextResponse.json({ ok: true, asset });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message }, { status: 403 });
    }
    if (e instanceof AiSpaceTtsError) {
      return NextResponse.json(
        { error: e.message, logId: e.logId },
        { status: e.status },
      );
    }
    console.error("[ai-space/audio-assets/tts] failed", e);
    return NextResponse.json({ error: "语音合成失败" }, { status: 500 });
  }
}
