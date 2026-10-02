import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { syncEcomBrandViProjectPlanFromAssets } from "@/lib/ecom/ecom-brand-vi-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const { project, recoveredImages } = await syncEcomBrandViProjectPlanFromAssets(
    auth.userId,
    id,
  );
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  return ecomJson({ project, recoveredImages });
}
