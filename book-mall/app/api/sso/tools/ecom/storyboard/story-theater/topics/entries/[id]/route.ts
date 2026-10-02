import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  deleteUserStoryTheaterTopic,
  updateUserStoryTheaterTopic,
} from "@/lib/ecom/ecom-story-theater-topic-service";
import { parseStoryTheaterVertical } from "@/lib/ecom/story-theater-vertical-parse";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Parameters<typeof updateUserStoryTheaterTopic>[2] = {};
    const vertical = parseStoryTheaterVertical(
      typeof body.vertical === "string" ? body.vertical : null,
    );
    if (vertical) patch.vertical = vertical;
    if (typeof body.title === "string") patch.title = body.title.trim();
    if (typeof body.storyCore === "string") patch.storyCore = body.storyCore.trim();
    if (typeof body.storyType === "string") patch.storyType = body.storyType.trim();
    if (Array.isArray(body.tags)) {
      patch.tags = body.tags
        .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
        .map((t) => t.trim());
    }
    const entry = await updateUserStoryTheaterTopic(auth.userId, id, patch);
    return ecomJson({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    const status = message.includes("无权") ? 403 : 500;
    return ecomJson({ error: message }, { status });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const ok = await deleteUserStoryTheaterTopic(auth.userId, id);
    if (!ok) return ecomJson({ error: "条目不存在" }, { status: 404 });
    return ecomJson({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    const status = message.includes("无权") ? 403 : 500;
    return ecomJson({ error: message }, { status: status });
  }
}
