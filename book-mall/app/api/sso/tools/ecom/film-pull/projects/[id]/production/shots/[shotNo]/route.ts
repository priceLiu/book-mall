import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import {
  confirmFilmPullProductionScript,
  patchFilmPullProductionShot,
} from "@/lib/ecom/ecom-film-pull-service";
import type { FilmPullProductionShot } from "@/lib/ecom/ecom-film-pull-types";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; shotNo: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id, shotNo: shotNoRaw } = await ctx.params;
  const shotNo = Number.parseInt(shotNoRaw, 10);
  if (!Number.isFinite(shotNo) || shotNo < 1) {
    return NextResponse.json({ error: "无效镜号" }, { status: 400 });
  }
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await patchFilmPullProductionShot(
      auth.userId,
      id,
      shotNo,
      body as Partial<FilmPullProductionShot>,
    );
    return NextResponse.json({ project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "更新失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
