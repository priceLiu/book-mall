import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import { checkPins } from "@/lib/ai-space/ai-space-pin-service";
import { isAiSpacePinSourceType } from "@/lib/ai-space/ai-space-pin-types";
import { countBlockRefsBySource } from "@/lib/ai-space/ai-space-space-refs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 删源前检测：源作品是否已收进空间，以及在自由画布上被引用了多少次。
 * 前端据此在二次确认文案中提示「个人空间展示将一并移除」。
 *
 * `GET ?sourceType=t2i_library&sourceId=a&sourceId=b`
 */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  const url = new URL(req.url);
  const sourceType = url.searchParams.get("sourceType")?.trim();
  if (!isAiSpacePinSourceType(sourceType)) {
    return NextResponse.json({ error: "不支持的 sourceType" }, { status: 400 });
  }
  const sourceIds = url.searchParams
    .getAll("sourceId")
    .flatMap((v) => v.split(","))
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 200);
  if (sourceIds.length === 0) {
    return NextResponse.json({ error: "缺少 sourceId" }, { status: 400 });
  }

  try {
    const [result, blockRefs] = await Promise.all([
      checkPins({ userId: auth.actor.userId, sourceType, sourceIds }),
      countBlockRefsBySource({ userId: auth.actor.userId, sourceType, sourceIds }),
    ]);
    const pinnedCount = Object.values(result).filter((r) => r.pinned).length;
    const blockRefCount = Object.values(blockRefs).reduce((n, v) => n + v, 0);
    return NextResponse.json({ result, pinnedCount, blockRefs, blockRefCount });
  } catch (e) {
    console.error("[ai-space/pins/check] GET failed", e);
    // 检测失败不应阻断删除流程；返回全 false 让前端用通用文案
    const fallback = Object.fromEntries(
      sourceIds.map((id) => [id, { pinned: false, pinIds: [] as string[] }]),
    );
    return NextResponse.json({
      result: fallback,
      pinnedCount: 0,
      blockRefs: Object.fromEntries(sourceIds.map((id) => [id, 0])),
      blockRefCount: 0,
      degraded: true,
    });
  }
}
