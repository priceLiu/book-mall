import { NextResponse } from "next/server";

import { assertEcomToolkitGatewayAccess } from "@/lib/ecom/ecom-gateway-auth";
import { resumePendingSeedVideoPanelShots } from "@/lib/ecom/ecom-seed-video-panel-resume";
import { getEcomSeedVideoProject } from "@/lib/ecom/ecom-seed-video-service";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** 单独续查 pending 镜头任务，避免 GET 项目时 resume 占满 dev 单 worker、阻塞 panel/generate */
export async function POST(_req: Request, ctx: Ctx) {
  const auth = verifyToolsBearer(_req);
  if (!auth.ok) return NextResponse.json({ error: "未登录" }, { status: 401 });
  const { id: projectId } = await ctx.params;

  try {
    await assertEcomToolkitGatewayAccess(auth.userId);
    const project = await getEcomSeedVideoProject(auth.userId, projectId, {
      resumePending: false,
    });
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 404 });
    }

    const resumed = await resumePendingSeedVideoPanelShots({
      userId: auth.userId,
      projectId,
      meta: (project.meta ?? {}) as Record<string, unknown>,
      plan: project.plan,
    });

    if (resumed.changed) {
      await prisma.ecomSeedVideoProject.update({
        where: { id: projectId },
        data: {
          meta: resumed.meta as Prisma.InputJsonValue,
          plan: resumed.plan as Prisma.InputJsonValue,
          status: "production",
        },
      });
    }

    const fresh = await getEcomSeedVideoProject(auth.userId, projectId, {
      resumePending: false,
    });
    return NextResponse.json({ project: fresh });
  } catch (e) {
    const message = e instanceof Error ? e.message : "续查失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
