import { NextResponse } from "next/server";

import { suggestProductDesignBrief } from "@/lib/ecom/ecom-product-design-brief-suggest";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getProductDesignProject } from "@/lib/ecom/ecom-product-design-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: { modelKey?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* empty body ok */
  }

  const modelKey =
    typeof body.modelKey === "string" && body.modelKey.trim()
      ? body.modelKey.trim()
      : undefined;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getProductDesignProject(auth.userId, id);
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }
    const result = await suggestProductDesignBrief({
      userId: auth.userId,
      projectId: id,
      modelKey,
    });
    const updated = await getProductDesignProject(auth.userId, id);
    return NextResponse.json({
      suggestions: result.suggestions,
      project: updated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "推断失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
