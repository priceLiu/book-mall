/**
 * 素材引用检测（跨应用统一入口）
 *
 * 子应用删除自己引用的 AI 空间素材前，先问一次「还有谁在用」，
 * 便于在二次确认里写清影响面。作品墙展示由 `pins/check` 单独负责。
 */

import { NextResponse } from "next/server";

import { checkAiSpaceAudioReferences } from "@/lib/ai-space/ai-space-audio-service";
import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { checkAiSpaceDigitalHumanReferences } from "@/lib/ai-space/ai-space-digital-human-service";
import { checkPins } from "@/lib/ai-space/ai-space-pin-service";
import { countBlockRefsBySource } from "@/lib/ai-space/ai-space-space-refs";
import { checkAiSpaceVideoMaterialReferences } from "@/lib/ai-space/ai-space-video-material-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const KIND_TO_PIN_SOURCE = {
  "digital-human": "ai_space_digital_human",
  audio: "ai_space_audio",
  video: "ai_space_video",
} as const;

type RefKind = keyof typeof KIND_TO_PIN_SOURCE;

function isRefKind(v: unknown): v is RefKind {
  return typeof v === "string" && v in KIND_TO_PIN_SOURCE;
}

export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind")?.trim();
  const id = url.searchParams.get("id")?.trim();
  if (!isRefKind(kind)) {
    return NextResponse.json(
      { error: "kind 仅支持 digital-human / audio / video" },
      { status: 400 },
    );
  }
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });

  try {
    const userId = auth.actor.userId;
    const [refs, pin, blockRefs] = await Promise.all([
      kind === "digital-human"
        ? checkAiSpaceDigitalHumanReferences(userId, id)
        : kind === "audio"
          ? checkAiSpaceAudioReferences(userId, id)
          : checkAiSpaceVideoMaterialReferences(userId, id),
      checkPins({
        userId,
        sourceType: KIND_TO_PIN_SOURCE[kind],
        sourceIds: [id],
      }),
      countBlockRefsBySource({
        userId,
        sourceType: KIND_TO_PIN_SOURCE[kind],
        sourceIds: [id],
      }),
    ]);
    return NextResponse.json({
      kind,
      id,
      refs,
      pinned: pin[id]?.pinned ?? false,
      // 作品墙自由画布上的引用数：删素材后这些位置会变成「素材已删除」占位
      blockRefCount: blockRefs[id] ?? 0,
    });
  } catch (e) {
    console.error("[ai-space/refs/check] failed", e);
    return NextResponse.json({ error: "引用检测失败" }, { status: 500 });
  }
}
