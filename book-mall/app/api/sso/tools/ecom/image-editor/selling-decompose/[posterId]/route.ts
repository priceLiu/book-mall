import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  beginSellingDecompose,
  isSellingPosterId,
  probeSellingDecompose,
} from "@/lib/ecom/ecom-selling-poster-decompose";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ posterId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  const { posterId } = await ctx.params;
  if (!isSellingPosterId(posterId)) {
    return ecomJson({ error: "贴纸编号无效" }, { status: 400 });
  }
  const looked = await probeSellingDecompose(posterId);
  return ecomJson(looked);
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;
  const { posterId } = await ctx.params;
  if (!isSellingPosterId(posterId)) {
    return ecomJson({ error: "贴纸编号无效" }, { status: 400 });
  }

  const contentType = req.headers.get("content-type") ?? "";
  let file: Buffer | undefined;
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const blob = form.get("file");
    if (blob instanceof File && blob.size > 0) {
      if (blob.size > 30 * 1024 * 1024) {
        return ecomJson({ error: "图片过大" }, { status: 400 });
      }
      file = Buffer.from(await blob.arrayBuffer());
    }
  }

  try {
    if (file) await assertEcomToolkitGatewayAccess(auth.userId);
    const result = await beginSellingDecompose({ userId: auth.userId, posterId, file });
    return ecomJson(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "拆分失败";
    const status = e instanceof GatewayRequiredError ? e.httpStatus : 502;
    return ecomJson({ error: msg }, { status });
  }
}
