import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteUserStoryTheaterTopic,
  updateUserStoryTheaterTopic,
  type StoryTheaterVertical,
} from "@/lib/ecom/ecom-story-theater-topic-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function parseVertical(raw: unknown): StoryTheaterVertical | undefined {
  if (raw === "fashion_apparel" || raw === "bags" || raw === "digital_3c") return raw;
  return undefined;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Parameters<typeof updateUserStoryTheaterTopic>[2] = {};
    const vertical = parseVertical(body.vertical);
    if (vertical) patch.vertical = vertical;
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.storyCore === "string") patch.storyCore = body.storyCore.trim();
    if (typeof body.storyType === "string") patch.storyType = body.storyType.trim();
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags
        .filter((t): t is string => typeof t === "string" && t.trim())
        .map((t) => t.trim());
    }
    const entry = await updateUserStoryTheaterTopic(auth.userId, id, patch);
    return NextResponse.json({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message.includes("无权") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const ok = await deleteUserStoryTheaterTopic(auth.userId, id);
    if (!ok) return NextResponse.json({ error: "条目不存在" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("无权") ? 403 : 500;
    return NextResponse.json({ error: message }, { status: status });
  }
}
