import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { buildFilmPullExportJson, buildFilmPullExportZip } from "@/lib/ecom/ecom-film-pull-export";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const format = url.searchParams.get("format") ?? "json";

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    if (format === "zip") {
      const { buf, fileName } = await buildFilmPullExportZip(auth.userId, id);
      return new Response(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        },
      });
    }
    const data = await buildFilmPullExportJson(auth.userId, id);
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
