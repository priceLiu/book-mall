import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { listEcomPromptLibrary } from "@/lib/ecom/ecom-prompt-library-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return ecomJson({ error: "未登录" }, { status: 401 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const url = new URL(req.url);
    const kindParam = url.searchParams.get("kind")?.trim();
    const kind =
      kindParam === "image" || kindParam === "video" || kindParam === "all" ? kindParam : "all";
    const q = url.searchParams.get("q")?.trim() || undefined;
    const items = await listEcomPromptLibrary(auth.userId, { kind, q });
    return ecomJson({ items });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}
