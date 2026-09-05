import { NextResponse } from "next/server";

import {
  imageGenPlanItemSchema,
  productContextSchema,
} from "@/lib/ecom/ecom-product-design-types";
import { patchImageGenPlan } from "@/lib/ecom/ecom-product-design-image-plan";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  const target = body.target === "detail" ? "detail" : "main";

  let productContext: ReturnType<typeof productContextSchema.parse> | undefined;
  if (body.productContext && typeof body.productContext === "object") {
    const parsed = productContextSchema.safeParse(body.productContext);
    if (!parsed.success) {
      return NextResponse.json({ error: "productContext 格式不正确" }, { status: 400 });
    }
    productContext = parsed.data;
  }

  let items: ReturnType<typeof imageGenPlanItemSchema.parse>[] | undefined;
  if (Array.isArray(body.items)) {
    items = [];
    for (const row of body.items) {
      const parsed = imageGenPlanItemSchema.safeParse(row);
      if (!parsed.success) {
        return NextResponse.json({ error: "items 格式不正确" }, { status: 400 });
      }
      items.push(parsed.data);
    }
  }

  const sharedVisualBrief =
    typeof body.sharedVisualBrief === "string" ? body.sharedVisualBrief : undefined;

  try {
    const result = await patchImageGenPlan({
      userId: auth.userId,
      projectId: id,
      target,
      productContext,
      sharedVisualBrief,
      items,
    });
    return NextResponse.json({ plan: result.plan, project: result.project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
