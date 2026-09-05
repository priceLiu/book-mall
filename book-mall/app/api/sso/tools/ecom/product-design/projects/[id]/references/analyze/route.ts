import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  analyzeProductDesignReferences,
  type ProductDesignVisionTarget,
} from "@/lib/ecom/ecom-product-design-vision";
import { getProductDesignProject } from "@/lib/ecom/ecom-product-design-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { target?: unknown; modelKey?: unknown; analysisMode?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const target = body.target === "detail" ? "detail" : "main";
  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : undefined;

  const analysisMode =
    body.analysisMode === "reference-style" ? "reference-style" : "copy";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await analyzeProductDesignReferences({
      userId: auth.userId,
      projectId: id,
      target: target as ProductDesignVisionTarget,
      modelKey,
      analysisMode,
    });
    const project = await getProductDesignProject(auth.userId, id);
    return NextResponse.json({
      entry: result.entry,
      project,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "分析失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
