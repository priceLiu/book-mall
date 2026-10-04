import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { generateSimpleFusionModelFromText } from "@/lib/ecom/simple-fusion-video/service";
import { formatEcomImageGenUserError } from "@/lib/ecom/ecom-image-processing-error";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* */
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return ecomJson({ error: "请填写模特描述" }, { status: 400 });
  try {
    const project = await generateSimpleFusionModelFromText(auth.userId, id, prompt);
    return ecomJson({ project });
  } catch (e) {
    const { message, status } = formatEcomImageGenUserError(e);
    return ecomJson({ error: message }, { status });
  }
}
