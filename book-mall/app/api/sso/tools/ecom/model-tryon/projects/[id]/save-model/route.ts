import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { saveEcomModelTryonModelImage } from "@/lib/ecom/ecom-model-tryon-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  await ctx.params;

  let body: { ossUrl?: string; title?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return ecomJson({ error: "无效 JSON" }, { status: 400 });
  }

  const ossUrl = body.ossUrl?.trim();
  if (!ossUrl) return ecomJson({ error: "缺少 ossUrl" }, { status: 400 });

  try {
    const result = await saveEcomModelTryonModelImage(auth.userId, {
      ossUrl,
      title: body.title,
    });
    return ecomJson(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "保存失败";
    return ecomJson({ error: message }, { status: 400 });
  }
}
