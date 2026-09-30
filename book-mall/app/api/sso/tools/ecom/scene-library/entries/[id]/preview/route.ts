import { ecomJson } from "@/lib/ecom/ecom-gateway-log-capture";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { uploadSceneLibraryEntryPreview } from "@/lib/ecom/ecom-scene-library-preview-upload";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return ecomJson({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return ecomJson({ error: "请以 multipart/form-data 上传" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return ecomJson({ error: "file 必填" }, { status: 400 });
    }
    const contentType = file.type || "image/jpeg";
    const entry = await uploadSceneLibraryEntryPreview({
      id,
      actorUserId: auth.userId,
      buf: Buffer.from(await file.arrayBuffer()),
      contentType,
      ext: pickUploadExt(contentType, file.name),
    });
    return ecomJson({ entry });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    const status =
      message.includes("无权") || message.includes("不可") || message.includes("不存在")
        ? 403
        : 500;
    return ecomJson({ error: message }, { status });
  }
}
