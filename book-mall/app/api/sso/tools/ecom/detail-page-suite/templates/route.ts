import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { listEnabledTemplatesForUser } from "@/lib/ecom/detail-page-suite/template-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const url = new URL(req.url);
    const items = await listEnabledTemplatesForUser({
      userId: auth.userId,
      platformCode: url.searchParams.get("platformCode") ?? undefined,
    });
    return ecomJson({ items });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "加载失败" },
      { status: 500 },
    );
  }
}
