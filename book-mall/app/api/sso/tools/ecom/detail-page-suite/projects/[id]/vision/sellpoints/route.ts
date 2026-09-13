import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  polishDetailPageSuiteSellpoints,
  visionSellpointsFromProductImages,
} from "@/lib/ecom/detail-page-suite/vision-sellpoints";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const modelKey = typeof body.modelKey === "string" ? body.modelKey : undefined;
    const project =
      body.action === "polish"
        ? await polishDetailPageSuiteSellpoints({
            userId: auth.userId,
            projectId: id,
            modelKey,
          })
        : await visionSellpointsFromProductImages({
            userId: auth.userId,
            projectId: id,
            modelKey,
          });
    return NextResponse.json({ project });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "识图失败" },
      { status: 400 },
    );
  }
}
