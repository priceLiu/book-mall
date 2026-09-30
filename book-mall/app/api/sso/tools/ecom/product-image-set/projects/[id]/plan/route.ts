import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { planProductImageSet } from "@/lib/ecom/product-image-set/plan";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { visionModelKey?: string } = {};
  try {
    body = (await req.json()) as { visionModelKey?: string };
  } catch {
    /* empty body ok */
  }
  try {
    const project = await planProductImageSet({
      userId: auth.userId,
      projectId: id,
      visionModelKey: body.visionModelKey,
    });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "生成占位失败" },
      { status: 400 },
    );
  }
}
