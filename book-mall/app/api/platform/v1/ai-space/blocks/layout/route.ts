import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  isAiSpaceSpaceError,
  saveSpaceLayout,
} from "@/lib/ai-space/ai-space-space-service";
import type { AiSpaceBlockLayoutInput } from "@/lib/ai-space/ai-space-space-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 拖拽结束后批量存坐标。
 * 宽高由服务端按块的尺寸档位重算，前端传的 w/h 仅作参考，防止绕过档位约束。
 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  if (!Array.isArray(body.items)) {
    return NextResponse.json({ error: "缺少 items 数组" }, { status: 400 });
  }

  const items: AiSpaceBlockLayoutInput[] = [];
  for (const raw of body.items) {
    const o = (raw ?? {}) as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!id) continue;
    items.push({
      id,
      layoutX: typeof o.layoutX === "number" ? o.layoutX : 0,
      layoutY: typeof o.layoutY === "number" ? o.layoutY : 0,
      layoutW: typeof o.layoutW === "number" ? o.layoutW : 6,
      layoutH: typeof o.layoutH === "number" ? o.layoutH : 6,
      mobileOrder: typeof o.mobileOrder === "number" ? o.mobileOrder : 0,
    });
  }

  try {
    await saveSpaceLayout(auth.actor.userId, items);
    return NextResponse.json({ ok: true, saved: items.length });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/blocks/layout] PATCH failed", e);
    return NextResponse.json({ error: "保存布局失败" }, { status: 500 });
  }
}
