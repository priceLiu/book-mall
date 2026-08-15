import { NextResponse } from "next/server";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadEcomTemplateGalleryPreview } from "@/lib/canvas/canvas-oss";

export const dynamic = "force-dynamic";
// 模板原图常有 10MB+ 的 PNG，再叠加 OSS 回源，60s 不够
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  // multipart 直传：base64 dataURL 会把体积撑大 1/3，大图容易顶到网关上限
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请以 multipart/form-data 上传" }, { status: 400 });
  }

  const file = form.get("file");
  const category = String(form.get("category") ?? "").trim();
  const id = String(form.get("id") ?? "").trim() || `tmp-${Date.now()}`;
  if (!(file instanceof File) || file.size === 0 || !category) {
    return NextResponse.json({ error: "file / category 必填" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const url = await uploadEcomTemplateGalleryPreview({
      category,
      id,
      buf,
      contentType,
      ext: pickUploadExt(contentType, file.name),
    });
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 500 },
    );
  }
}
