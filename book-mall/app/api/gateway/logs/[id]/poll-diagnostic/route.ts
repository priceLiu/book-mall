import { NextResponse, type NextRequest } from "next/server";

import { diagnoseGatewayPollStall } from "@/lib/gateway/gateway-poll-stall-diagnostics";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** 单条 Gateway 日志 · Poll Δ 停摆诊断（batch 饿死 / pool / worker） */
export async function GET(_request: NextRequest, ctx: Ctx) {
  const user = await requireGatewaySessionUser(_request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const { id: logId } = await ctx.params;
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { id: true, status: true, userId: true },
  });
  if (!log) {
    return NextResponse.json({ error: "日志不存在" }, { status: 404 });
  }

  const diagnostic = await diagnoseGatewayPollStall(logId);
  if (!diagnostic) {
    return NextResponse.json({
      logId,
      stalled: false,
      message: "Poll Δ 在正常范围内，或任务已终态",
    });
  }

  return NextResponse.json({
    logId,
    stalled: true,
    diagnostic,
  });
}
