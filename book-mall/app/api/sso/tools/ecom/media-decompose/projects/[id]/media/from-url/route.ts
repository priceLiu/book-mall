import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { setMediaDecomposeFromUrl } from "@/lib/ecom/ecom-media-decompose-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  let body: { url?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    return NextResponse.json({ error: "缺少 url" }, { status: 400 });
  }

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await setMediaDecomposeFromUrl(auth.userId, id, url);
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "链接导入失败";
    const status =
      message === "项目不存在"
        ? 404
        : message.includes("过大") || message.includes("https")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
