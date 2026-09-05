import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { isFilmPullMockAllowed } from "@/lib/ecom/ecom-film-pull-mock";
import {
  getEcomFilmPullProject,
  patchFilmPullProductionShot,
} from "@/lib/ecom/ecom-film-pull-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; shotNo: string }> };

const MOCK_IMAGE =
  "https://book-mall-assets.oss-cn-hangzhou.aliyuncs.com/dev/mock/film-pull-shot.png";

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  if (!isFilmPullMockAllowed()) {
    return NextResponse.json({ error: "Mock 未启用" }, { status: 403 });
  }
  const { id, shotNo: shotNoRaw } = await ctx.params;
  const shotNo = Number.parseInt(shotNoRaw, 10);
  if (!Number.isFinite(shotNo) || shotNo < 1) {
    return NextResponse.json({ error: "无效镜号" }, { status: 400 });
  }
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    await patchFilmPullProductionShot(auth.userId, id, shotNo, {
      imageUrl: MOCK_IMAGE,
      status: "pending_video",
    });
    const project = await getEcomFilmPullProject(auth.userId, id);
    return NextResponse.json({ shotNo, imageUrl: MOCK_IMAGE, project });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Mock 生图失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
