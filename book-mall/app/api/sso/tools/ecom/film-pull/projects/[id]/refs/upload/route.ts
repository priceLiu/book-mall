import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resolveFilmPullCharacterUpload } from "@/lib/ecom/ecom-film-pull-media";
import { appendFilmPullRef } from "@/lib/ecom/ecom-film-pull-service";
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

  const roleRaw = String(form.get("role") ?? "").trim();
  if (roleRaw !== "model" && roleRaw !== "product") {
    return NextResponse.json({ error: "role 须为 model 或 product" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "缺少 file" }, { status: 400 });
  }
  if (file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "文件过大（最大 30MB）" }, { status: 413 });
  }

  const contentType = file.type || "image/jpeg";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const buf = Buffer.from(await file.arrayBuffer());
    const ossUrl = await resolveFilmPullCharacterUpload({
      userId: auth.userId,
      buf,
      contentType,
    });
    const project = await appendFilmPullRef(auth.userId, id, roleRaw, ossUrl);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    const status = message.includes("请先") || message.includes("最多") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
