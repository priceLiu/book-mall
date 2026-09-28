import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { newFilmPullMediaId } from "@/lib/ecom/ecom-film-pull-media";
import { uploadFilmPullMedia } from "@/lib/ecom/ecom-film-pull-service";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { assetId?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "invalid_json" }, { status: 400 });
  }
  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  if (!assetId) return ecomJson({ error: "缺少 assetId" }, { status: 400 });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const asset = await prisma.ecomAsset.findFirst({
      where: { userId: auth.userId, id: assetId },
      select: { ossUrl: true, title: true, kind: true },
    });
    if (!asset?.ossUrl?.trim()) return ecomJson({ error: "资产不存在" }, { status: 404 });
    if (asset.kind !== "video") {
      return ecomJson({ error: "专业拉片须选择视频资产" }, { status: 400 });
    }
    const project = await uploadFilmPullMedia(auth.userId, id, {
      id: newFilmPullMediaId(),
      ossUrl: asset.ossUrl.trim(),
      source: "asset",
      label: asset.title?.slice(0, 40) || "我的资产",
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "关联失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
