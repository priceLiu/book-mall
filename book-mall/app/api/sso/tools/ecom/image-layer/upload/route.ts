import { NextResponse } from "next/server";

import {
  appendEcomImageLayerGeneration,
  saveEcomImageLayerWorkspace,
} from "@/lib/ecom/ecom-image-layer-project-service";
import { uploadImageLayerSource } from "@/lib/ecom/ecom-image-layer-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return auth.res;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "无效表单" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const contentType =
      typeof file.type === "string" && file.type.trim()
        ? file.type
        : "image/jpeg";
    const result = await uploadImageLayerSource({
      userId: auth.userId,
      buf,
      contentType,
    });

    const projectIdRaw = form.get("projectId");
    const projectId =
      typeof projectIdRaw === "string" && projectIdRaw.trim() ? projectIdRaw.trim() : undefined;
    if (projectId) {
      await saveEcomImageLayerWorkspace(auth.userId, projectId, {
        sourceImageUrl: result.ossUrl,
        stack: null,
        pendingBbox: null,
      });
      await appendEcomImageLayerGeneration(auth.userId, projectId, {
        kind: "upload",
        title: "上传原图",
        ossUrl: result.ossUrl,
      });
    }

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
