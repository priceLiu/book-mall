import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  isAiSpaceSpaceError,
  publishSpacePage,
} from "@/lib/ai-space/ai-space-space-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 发布 / 取消发布公开空间页 */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  if (typeof body.publish !== "boolean") {
    return NextResponse.json({ error: "缺少 publish 布尔值" }, { status: 400 });
  }

  try {
    const page = await publishSpacePage(auth.actor.userId, body.publish);
    return NextResponse.json({ ok: true, page });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/page/publish] POST failed", e);
    return NextResponse.json({ error: "发布状态更新失败" }, { status: 500 });
  }
}
