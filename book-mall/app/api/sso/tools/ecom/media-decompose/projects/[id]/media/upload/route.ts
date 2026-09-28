import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { uploadMediaDecomposeMedia } from "@/lib/ecom/ecom-media-decompose-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return ecomJson({ error: "无效表单" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return ecomJson({ error: "缺少 file" }, { status: 400 });
  }

  const label = String(form.get("label") ?? "").slice(0, 40);
  const fileName = file instanceof File ? file.name : undefined;
  const contentType = file.type || "application/octet-stream";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const buf = Buffer.from(await file.arrayBuffer());
    const project = await uploadMediaDecomposeMedia(auth.userId, id, {
      buf,
      contentType,
      fileName,
      label: label || undefined,
    });
    return ecomJson({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    const status = message === "项目不存在" ? 404 : message.includes("过大") ? 413 : 500;
    return ecomJson({ error: message }, { status });
  }
}
