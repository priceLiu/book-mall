import { NextResponse } from "next/server";

import { pickUploadExt } from "@/lib/admin/media-upload";
import { requireFinanceAdminApi } from "@/lib/admin/require-finance-admin-api";
import { uploadSceneLibraryEntryPreview } from "@/lib/ecom/ecom-scene-library-preview-upload";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const auth = await requireFinanceAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await ctx.params;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "请以 multipart/form-data 上传" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "file 必填" }, { status: 400 });
  }

  try {
    const contentType = file.type || "image/jpeg";
    const entry = await uploadSceneLibraryEntryPreview({
      id,
      actorUserId: auth.userId,
      allowPlatform: true,
      buf: Buffer.from(await file.arrayBuffer()),
      contentType,
      ext: pickUploadExt(contentType, file.name),
    });
    return NextResponse.json({ entry });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "上传失败" },
      { status: 500 },
    );
  }
}
