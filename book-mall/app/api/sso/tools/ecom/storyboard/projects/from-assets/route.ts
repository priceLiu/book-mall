import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { ensureStoryboardRefImageForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import {
  createEcomStoryboardProject,
  updateEcomStoryboardProject,
} from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";
import { prisma } from "@/lib/prisma";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** 电商产品创作 →「去做视频」：用选中的资产图开一个预置参考图的故事版 */
export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { assetIds?: unknown; title?: unknown; role?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const assetIds = Array.isArray(body.assetIds)
    ? [...new Set(body.assetIds.filter((v): v is string => typeof v === "string" && !!v.trim()))]
    : [];
  if (assetIds.length === 0) {
    return NextResponse.json({ error: "请至少选择一张图片" }, { status: 400 });
  }

  const roleRaw = typeof body.role === "string" ? body.role : "product";
  const role: StoryboardReference["role"] =
    roleRaw === "product" || roleRaw === "scene" ? roleRaw : "product";
  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 120)
      : "产品视频";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);

    const assets = await prisma.ecomAsset.findMany({
      where: { userId: auth.userId, id: { in: assetIds }, kind: "image" },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, ossUrl: true },
    });
    if (assets.length === 0) {
      return NextResponse.json({ error: "找不到所选图片" }, { status: 404 });
    }

    const references: StoryboardReference[] = [];
    for (const asset of assets.slice(0, 8)) {
      const url = asset.ossUrl?.trim();
      if (!url || !/^https?:\/\//.test(url)) continue;
      const { url: normalized } = await ensureStoryboardRefImageForWan27({
        userId: auth.userId,
        imageUrl: url,
      });
      references.push({
        id: `ref-${asset.id.slice(-8)}-${references.length}`,
        label: (asset.title ?? "产品图").slice(0, 40),
        role,
        ossUrl: normalized,
      });
    }
    if (references.length === 0) {
      return NextResponse.json({ error: "所选图片不可用" }, { status: 400 });
    }

    const created = await createEcomStoryboardProject(auth.userId, { title });
    const project = await updateEcomStoryboardProject(auth.userId, created.id, {
      references,
      meta: { fromProductCreation: true },
    });

    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
