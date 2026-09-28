import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resetProductDesignProject } from "@/lib/ecom/ecom-product-design-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await resetProductDesignProject(auth.userId, id);
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "重置失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}
