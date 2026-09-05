import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resolveFilmPullCharacterUpload } from "@/lib/ecom/ecom-film-pull-media";
import { addFilmPullCharacterRef } from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
  const contentType = file.type || "image/jpeg";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const buf = Buffer.from(await file.arrayBuffer());
    const ossUrl = await resolveFilmPullCharacterUpload({
      userId: auth.userId,
      buf,
      contentType,
    });
    const project = await addFilmPullCharacterRef(auth.userId, id, {
      id: randomUUID(),
      ossUrl,
      label: label || "角色参考",
    });
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
