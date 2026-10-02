import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  addBrandViSketchUpload,
  getEcomBrandViProject,
  removeBrandViReference,
  resetBrandViProjectForNewSketch,
} from "@/lib/ecom/ecom-brand-vi-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  if (file.size > 30 * 1024 * 1024) {
    return ecomJson({ error: "文件过大（最大 30MB）" }, { status: 413 });
  }

  const label = String(form.get("label") ?? "手绘线稿").slice(0, 40);
  // 换主线稿 = 换 IP：按 SOP 通用规则回到第 1 步重启，不复用旧素材
  const resetFlow = String(form.get("resetFlow") ?? "") === "1";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (resetFlow) {
      await resetBrandViProjectForNewSketch(auth.userId, id);
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const ref = await addBrandViSketchUpload(auth.userId, id, { label, buf });
    const project = await getEcomBrandViProject(auth.userId, id);
    return ecomJson({ reference: ref, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return ecomJson({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const refId = new URL(req.url).searchParams.get("refId")?.trim();
  if (!refId) return ecomJson({ error: "缺少 refId" }, { status: 400 });
  try {
    await removeBrandViReference(auth.userId, id, refId);
    return ecomJson({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "删除失败";
    return ecomJson({ error: message }, { status: 404 });
  }
}
