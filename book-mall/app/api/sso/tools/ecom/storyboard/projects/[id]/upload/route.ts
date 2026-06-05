import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { addStoryboardReferenceUpload } from "@/lib/ecom/ecom-storyboard-service";
import type { StoryboardReference } from "@/lib/ecom/ecom-storyboard-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
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

  const label = String(form.get("label") ?? "参考图").slice(0, 40);
  const roleRaw = String(form.get("role") ?? "other");
  const role: StoryboardReference["role"] =
    roleRaw === "character" || roleRaw === "product" || roleRaw === "scene"
      ? roleRaw
      : "other";

  if (file.size > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "文件过大（最大 30MB）" }, { status: 413 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const buf = Buffer.from(await file.arrayBuffer());
    const ref = await addStoryboardReferenceUpload(auth.userId, id, {
      label,
      role,
      buf,
    });
    return NextResponse.json({ reference: ref });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
