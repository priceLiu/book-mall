import { NextResponse } from "next/server";

import { resolveAiSpaceActor } from "@/lib/ai-space/ai-space-auth";
import {
  getSpacePageForOwner,
  isAiSpaceSpaceError,
  updateSpacePage,
} from "@/lib/ai-space/ai-space-space-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 取当前用户的空间页（首次访问自动建页 + 套默认模板） */
export async function GET(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  try {
    const page = await getSpacePageForOwner(auth.actor.userId);
    return NextResponse.json({ page });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/page] GET failed", e);
    return NextResponse.json({ error: "读取空间页失败" }, { status: 500 });
  }
}

/** 改标题 / 简介 / 主题 / 公开链接名 */
export async function PATCH(req: Request) {
  const auth = await resolveAiSpaceActor(req);
  if (!auth.ok) return auth.res;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求体须为 JSON" }, { status: 400 });
  }

  try {
    const page = await updateSpacePage(auth.actor.userId, {
      title: typeof body.title === "string" ? body.title : undefined,
      bio: typeof body.bio === "string" ? body.bio : undefined,
      slug: typeof body.slug === "string" ? body.slug : undefined,
      theme: "theme" in body ? body.theme : undefined,
    });
    return NextResponse.json({ ok: true, page });
  } catch (e) {
    if (isAiSpaceSpaceError(e)) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    console.error("[ai-space/page] PATCH failed", e);
    return NextResponse.json({ error: "更新空间页失败" }, { status: 500 });
  }
}
