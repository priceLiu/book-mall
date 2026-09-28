import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { listEcomLibrarySections } from "@/lib/ecom/ecom-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const sections = await listEcomLibrarySections(auth.userId);
    const totalAssets = sections.reduce((n, s) => n + s.assets.length, 0);
    const totalBundles = sections.reduce(
      (n, s) =>
        n +
        s.storyboardBundles.length +
        s.productDesignBundles.length +
        s.seedVideoBundles.length +
        s.handCraftBundles.length +
        s.mediaDecomposeBundles.length,
      0,
    );
    return ecomJson({ sections, totalAssets, totalBundles });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
