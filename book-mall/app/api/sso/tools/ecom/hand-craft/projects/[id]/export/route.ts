import { NextResponse } from "next/server";

import { exportHandCraftProjectZip } from "@/lib/ecom/ecom-hand-craft-export";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;

  try {
    const { buffer, filename } = await exportHandCraftProjectZip(auth.userId, id);
    const encoded = encodeURIComponent(filename);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "导出失败";
    const status = message === "项目不存在" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
