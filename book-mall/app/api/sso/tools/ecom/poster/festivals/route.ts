import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { POSTER_FESTIVAL_PACKS } from "@/lib/ecom/ecom-poster-festival-packs";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    return ecomJson({ items: POSTER_FESTIVAL_PACKS });
  } catch (e) {
    return ecomJson({ error: e instanceof Error ? e.message : "无权限" }, { status: 403 });
  }
}
