import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  FILM_PULL_V1_MAX_SEC,
  newFilmPullMediaId,
  resolveFilmPullUpload,
} from "@/lib/ecom/ecom-film-pull-media";
import { uploadFilmPullMedia } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

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

  const label = String(form.get("label") ?? "").slice(0, 40);
  const fileName = file instanceof File ? file.name : undefined;
  const contentType = file.type || "video/mp4";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const buf = Buffer.from(await file.arrayBuffer());
    const { ossUrl, durationSec } = await resolveFilmPullUpload({
      userId: auth.userId,
      buf,
      contentType,
      fileName,
    });
    const project = await uploadFilmPullMedia(auth.userId, id, {
      id: newFilmPullMediaId(),
      ossUrl,
      durationSec,
      source: "upload",
      label: label || "源视频",
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    const status =
      message.includes(`${FILM_PULL_V1_MAX_SEC}s`) || message.includes("长片分段") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
