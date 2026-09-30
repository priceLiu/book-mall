import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { suggestProductImageSetBrief } from "@/lib/ecom/product-image-set/suggest-brief";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { modelKey?: string } = {};
  try {
    body = (await req.json()) as { modelKey?: string };
  } catch {
    /* empty */
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await suggestProductImageSetBrief({
      userId: auth.userId,
      projectId: id,
      modelKey: body.modelKey,
    });
    return ecomJson(result);
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "AI 帮写失败" },
      { status: 400 },
    );
  }
}
