import { NextResponse } from "next/server";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadEcomTemplateGallerySlot } from "@/lib/canvas/canvas-oss";
import type { EcomTemplateGalleryUploadSlot } from "@/lib/canvas/canvas-constants";

export const dynamic = "force-dynamic";
// 模板原图常有 10MB+ 的 PNG，再叠加 OSS 回源，60s 不够
export const maxDuration = 300;

function parseSlot(raw: string): EcomTemplateGalleryUploadSlot {
  if (raw === "cover" || raw === "main" || raw === "ref") return raw;
  return "preview";
}

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
  const category = String(form.get("category") ?? "").trim();
  const id = String(form.get("id") ?? "").trim() || `tmp-${Date.now()}`;
  const slot = parseSlot(String(form.get("slot") ?? "preview"));
  const refKey = String(form.get("refKey") ?? "").trim() || undefined;
  const autoCover = String(form.get("autoCover") ?? "") === "1";

  if (!(file instanceof File) || file.size === 0 || !category) {
    return NextResponse.json({ error: "file / category 必填" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType = file.type || "application/octet-stream";
    const ext = pickUploadExt(contentType, file.name);

    const result = await uploadEcomTemplateGallerySlot({
      category,
      id,
      slot,
      buf,
      contentType,
      ext,
      refKey,
      autoCover: autoCover && (slot === "preview" || slot === "main"),
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 500 },
    );
  }
}
