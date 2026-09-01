import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { startFilmPullReplica } from "@/lib/ecom/ecom-film-pull-replica";
import { getEcomFilmPullProject } from "@/lib/ecom/ecom-film-pull-service";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomFilmPullProject(auth.userId, id);
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    const replicaId =
      typeof project.meta?.replicaSeedVideoProjectId === "string"
        ? project.meta.replicaSeedVideoProjectId.trim()
        : "";
    if (!replicaId) return NextResponse.json({ project, seedVideo: null });
    const seedVideo = await getEcomSeedVideoProject(auth.userId, replicaId);
    return NextResponse.json({ project, seedVideo });
  } catch (e) {
    const message = e instanceof Error ? e.message : "加载失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const { project, seedVideo } = await startFilmPullReplica(auth.userId, id);
    return NextResponse.json({ project, seedVideo });
  } catch (e) {
    const message = e instanceof Error ? e.message : "无法开始复刻";
    const status =
      message === "项目不存在"
        ? 404
        : message.includes("请先") || message.includes("缺少") || message.includes("没有")
          ? 400
          : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
