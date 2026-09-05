import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { newFilmPullMediaId } from "@/lib/ecom/ecom-film-pull-media";
import { uploadFilmPullMedia } from "@/lib/ecom/ecom-film-pull-service";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { assetId?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const assetId = typeof body.assetId === "string" ? body.assetId.trim() : "";
  if (!assetId) return NextResponse.json({ error: "缺少 assetId" }, { status: 400 });

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const asset = await prisma.ecomAsset.findFirst({
      where: { userId: auth.userId, id: assetId },
      select: { ossUrl: true, title: true, kind: true },
    });
    if (!asset?.ossUrl?.trim()) return NextResponse.json({ error: "资产不存在" }, { status: 404 });
    if (asset.kind !== "video") {
      return NextResponse.json({ error: "专业拉片须选择视频资产" }, { status: 400 });
    }
    const project = await uploadFilmPullMedia(auth.userId, id, {
      id: newFilmPullMediaId(),
      ossUrl: asset.ossUrl.trim(),
      source: "asset",
      label: asset.title?.slice(0, 40) || "我的资产",
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "关联失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
