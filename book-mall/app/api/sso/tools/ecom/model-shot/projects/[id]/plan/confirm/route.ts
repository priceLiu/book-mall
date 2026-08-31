import { NextResponse } from "next/server";

import {
  getEcomModelShotProject,
  updateEcomModelShotProject,
} from "@/lib/ecom/ecom-model-shot-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id } = await ctx.params;
  const project = await getEcomModelShotProject(auth.userId, id);
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.plan.items.length === 0) {
    return NextResponse.json({ error: "请先生成姿势方案" }, { status: 400 });
  }
  const updated = await updateEcomModelShotProject(auth.userId, id, {
    plan: { ...project.plan, status: "confirmed" },
    meta: { ...(project.meta ?? {}), phase: "generate" },
  });
  return NextResponse.json({ project: updated });
}
