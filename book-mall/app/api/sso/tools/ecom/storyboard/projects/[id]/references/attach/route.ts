import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ensureStoryboardRefImageForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  getEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** 把「我的资产」里的图挂到故事版参考图上（详情页长图会先归一化到厂商像素区间） */
export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { assetIds?: unknown; role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const assetIds = Array.isArray(body.assetIds)
    ? [...new Set(body.assetIds.filter((v): v is string => typeof v === "string" && !!v.trim()))]
    : [];
  if (assetIds.length === 0) {
    return NextResponse.json({ error: "请至少选择一张资产图" }, { status: 400 });
  }

  const roleRaw = typeof body.role === "string" ? body.role : "product";
  const role: StoryboardReference["role"] =
    roleRaw === "product" || roleRaw === "character" || roleRaw === "scene"
      ? roleRaw
      : "other";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomStoryboardProject(auth.userId, id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const assets = await prisma.ecomAsset.findMany({
      where: { userId: auth.userId, id: { in: assetIds }, kind: "image" },
      select: { id: true, title: true, ossUrl: true },
    });
    if (assets.length === 0) {
      return NextResponse.json({ error: "找不到所选资产" }, { status: 404 });
    }

    const added: StoryboardReference[] = [];
    for (const asset of assets) {
      const url = asset.ossUrl?.trim();
      if (!url || !/^https?:\/\//.test(url)) continue;
      const { url: normalized } = await ensureStoryboardRefImageForWan27({
        userId: auth.userId,
        imageUrl: url,
      });
      added.push({
        id: `ref-${asset.id.slice(-8)}-${Date.now()}${added.length}`,
        label: (asset.title ?? "资产图").slice(0, 40),
        role,
        ossUrl: normalized,
      });
    }
    if (added.length === 0) {
      return NextResponse.json({ error: "所选资产不可用" }, { status: 400 });
    }

    const updated = await updateEcomStoryboardProject(auth.userId, id, {
      references: [...project.references, ...added],
    });
    return NextResponse.json({ project: updated, added });
  } catch (e) {
    const message = e instanceof Error ? e.message : "挂载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
