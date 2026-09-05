import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  applySpaceTemplate,
  isAiSpaceSpaceError,
} from "@/lib/ai-space/ai-space-space-service";
import { isSpacePageTemplateKey } from "@/lib/ai-space/space-blocks/page-templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 套用整页版式模板（只重排几何，不删块） */
export async function POST(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  if (!isSpacePageTemplateKey(body.templateKey)) {
    return NextResponse.json({ error: "不支持的版式模板" }, { status: 400 });
  }

  try {
    const page = await applySpaceTemplate(auth.actor.userId, body.templateKey);
    return NextResponse.json({ ok: true, page });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/page/apply-template] POST failed", e);
    return NextResponse.json({ error: "套用模板失败" }, { status: 500 });
  }
}
