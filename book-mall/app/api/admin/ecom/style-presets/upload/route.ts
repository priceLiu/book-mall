import { NextResponse } from "next/server";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadEcomStylePresetAssets } from "@/lib/canvas/canvas-oss";
import { patchStylePresetEntry } from "@/lib/ecom/ecom-style-preset/db-service";
import { invalidateStylePresetCache } from "@/lib/ecom/ecom-style-preset/runtime";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请以 multipart/form-data 上传" }, { status: 400 });
  }

  const file = form.get("file");
  const id = String(form.get("id") ?? "").trim();
  if (!(file instanceof File) || file.size === 0 || !id) {
    return NextResponse.json({ error: "file / id 必填" }, { status: 400 });
  }

  try {
    const contentType = file.type || "image/jpeg";
    const ext = pickUploadExt(contentType, file.name);
    const buf = Buffer.from(await file.arrayBuffer());
    const { url, thumbUrl } = await uploadEcomStylePresetAssets({
      id,
      buf,
      contentType,
      ext,
    });
    const preset = await patchStylePresetEntry(id, {
      referenceUrl: url,
      thumbUrl,
    });
    invalidateStylePresetCache();
    return NextResponse.json({ url, thumbUrl, preset });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 500 },
    );
  }
}
