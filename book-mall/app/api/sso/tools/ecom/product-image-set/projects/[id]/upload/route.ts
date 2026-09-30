import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  removeProductImageSetRef,
  uploadProductImageSetLayoutRef,
  uploadProductImageSetRef,
} from "@/lib/ecom/product-image-set/project-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Ctx = { params: Promise<{ id: string }> };

const MAX_BYTES = 15 * 1024 * 1024;

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
  if (!(file instanceof Blob)) return ecomJson({ error: "缺少 file" }, { status: 400 });
  if (file.size > MAX_BYTES) return ecomJson({ error: "文件过大（最大 15MB）" }, { status: 413 });

  const role = String(form.get("role") ?? "product");
  const label = String(form.get("label") ?? "产品图").slice(0, 40);
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = file.type || "image/jpeg";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project =
      role === "layout-ref"
        ? await uploadProductImageSetLayoutRef(auth.userId, id, buf, mime, label)
        : await uploadProductImageSetRef(auth.userId, id, buf, mime, label);
    if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
    return ecomJson({ project });
  } catch (e) {
    return ecomJson(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const refId = url.searchParams.get("refId");
  if (!refId) return ecomJson({ error: "缺少 refId" }, { status: 400 });
  const project = await removeProductImageSetRef(auth.userId, id, refId);
  if (!project) return ecomJson({ error: "项目不存在" }, { status: 404 });
  return ecomJson({ project });
}
