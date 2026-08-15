import { NextResponse } from "next/server";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadEcomModelLibraryPreview } from "@/lib/canvas/canvas-oss";

export const dynamic = "force-dynamic";
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
  const id = String(form.get("id") ?? "").trim() || `model-${Date.now()}`;
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file 必填" }, { status: 400 });
  }

  try {
    const contentType = file.type || "image/jpeg";
    const url = await uploadEcomModelLibraryPreview({
      id,
      buf: Buffer.from(await file.arrayBuffer()),
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
