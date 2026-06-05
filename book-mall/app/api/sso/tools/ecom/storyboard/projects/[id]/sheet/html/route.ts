import { NextResponse } from "next/server";

import { exportStoryboardHtml } from "@/lib/ecom/ecom-storyboard-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  try {
    const { html, ossUrl } = await exportStoryboardHtml(auth.userId, id);
    const url = new URL(req.url);
    if (url.searchParams.get("download") === "1") {
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="storyboard-${id}.html"`,
        },
      });
    }
    return NextResponse.json({ html, sheetHtmlUrl: ossUrl });
  } catch (e) {
    const message = e instanceof Error ? e.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
