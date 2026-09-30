import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { generateProductImageSet } from "@/lib/ecom/product-image-set/generate";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 600;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: { modelKey?: string; imageSize?: string; slotIds?: string[]; regenerate?: boolean } =
    {};
  try {
    body = (await req.json()) as {
      modelKey?: string;
      imageSize?: string;
      slotIds?: string[];
      regenerate?: boolean;
    };
  } catch {
    /* empty */
  }
  try {
    const result = await generateProductImageSet({
      userId: auth.userId,
      projectId: id,
      modelKey: body.modelKey,
      imageSize: body.imageSize,
      slotIds: body.slotIds,
      regenerate: body.regenerate === true,
    });
    if (result.failures.length > 0) {
      console.error("[product-image-set] generate partial failure", {
        projectId: id,
        failures: result.failures,
      });
    }
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "生成失败";
    console.error("[product-image-set] generate failed", { projectId: id, message });
    return ecomJson({ error: message }, { status: 400 });
  }
}
