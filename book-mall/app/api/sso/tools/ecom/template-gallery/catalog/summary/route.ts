import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { getTemplateGalleryCategorySummary } from "@/lib/ecom/ecom-template-gallery-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 模板区分类概览（仅计数）：驱动分类 / 媒体开关，载荷 <1KB */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const categories = await getTemplateGalleryCategorySummary();
    return ecomJson({ categories });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
