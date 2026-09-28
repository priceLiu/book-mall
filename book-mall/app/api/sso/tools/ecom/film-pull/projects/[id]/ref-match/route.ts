import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  patchFilmPullRefMatchShot,
  saveFilmPullRefMatch,
} from "@/lib/ecom/ecom-film-pull-service";
import type { FilmPullRefMatch } from "@/lib/ecom/ecom-film-pull-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (body.refMatch && typeof body.refMatch === "object") {
      const project = await saveFilmPullRefMatch(
        auth.userId,
        id,
        body.refMatch as FilmPullRefMatch,
      );
      return ecomJson({ project });
    }
    const shotNo = Number(body.shotNo);
    if (!Number.isFinite(shotNo) || shotNo < 1) {
      return ecomJson({ error: "无效镜号" }, { status: 400 });
    }
    const patch: Partial<{ modelRefIds: string[]; productRefIds: string[] }> = {};
    if (Array.isArray(body.modelRefIds)) patch.modelRefIds = body.modelRefIds as string[];
    if (Array.isArray(body.productRefIds)) patch.productRefIds = body.productRefIds as string[];
    const project = await patchFilmPullRefMatchShot(auth.userId, id, shotNo, patch);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    return ecomJson({ error: message }, { status: 502 });
  }
}
