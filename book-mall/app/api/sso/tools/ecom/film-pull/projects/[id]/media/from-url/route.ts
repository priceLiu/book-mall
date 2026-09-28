import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { newFilmPullMediaId, resolveFilmPullFromUrl } from "@/lib/ecom/ecom-film-pull-media";
import { uploadFilmPullMedia } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { url?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return ecomJson({ error: "请填写视频链接" }, { status: 400 });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const { ossUrl, sourceUrl, durationSec } = await resolveFilmPullFromUrl({
      userId: auth.userId,
      url,
    });
    const project = await uploadFilmPullMedia(auth.userId, id, {
      id: newFilmPullMediaId(),
      ossUrl,
      durationSec,
      source: "url",
      sourceUrl,
      label: "链接视频",
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "导入失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}
