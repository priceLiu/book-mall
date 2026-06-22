import { NextResponse, type NextRequest } from "next/server";

import { recoverVolcengineGatewayLogFromVendor } from "@/lib/gateway/volcengine-stall-recover";
import { isRecoverableVolcengineStallFailCode } from "@/lib/gateway/video-background-generation";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 对误杀 / 后台任务向厂商复核并恢复（非阻塞 POST） */
export async function POST(request: NextRequest, ctx: Ctx) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: logId } = await ctx.params;
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { id: true, status: true, failCode: true, userId: true },
  });
  if (!log) {
    return NextResponse.json({ error: "日志不存在" }, { status: 404 });
  }

  if (
    log.status === "FAILED" &&
    !isRecoverableVolcengineStallFailCode(log.failCode)
  ) {
    return NextResponse.json(
      { error: "该失败类型不支持厂商复核恢复" },
      { status: 400 },
    );
  }

  const result = await recoverVolcengineGatewayLogFromVendor(logId);
  return NextResponse.json(result, { status: result.ok ? 200 : 409 });
}
