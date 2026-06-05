import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { saveStoryboardSheetPng } from "@/lib/ecom/ecom-storyboard-service";
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

  let buf: Buffer;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "缺少 file" }, { status: 400 });
    }
    buf = Buffer.from(await file.arrayBuffer());
  } else {
    let body: { pngBase64?: string };
    try {
      body = (await req.json()) as { pngBase64?: string };
    } catch {
      return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
    }
    const raw = body.pngBase64?.trim() ?? "";
    const b64 = raw.replace(/^data:image\/png;base64,/, "");
    if (!b64) {
      return NextResponse.json({ error: "缺少 pngBase64" }, { status: 400 });
    }
    buf = Buffer.from(b64, "base64");
  }

  if (buf.length > 30 * 1024 * 1024) {
    return NextResponse.json({ error: "PNG 过大" }, { status: 413 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const sheetPngUrl = await saveStoryboardSheetPng(auth.userId, id, buf);
    return NextResponse.json({ sheetPngUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "上传失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
