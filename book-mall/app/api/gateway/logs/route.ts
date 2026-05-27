import { NextResponse, type NextRequest } from "next/server";
import { requireGatewaySessionUser } from "@/lib/gateway/session";
import {
  expireStaleGatewayLogs,
  runGatewayPollWorker,
} from "@/lib/gateway/poll-service";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  try {
    await runGatewayPollWorker({ limit: 15 });
  } catch {
    /* 列表页 opportunistic 轮询 */
  }
  try {
    await expireStaleGatewayLogs();
  } catch {
    /* ignore */
  }

  const limit = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("limit") ?? "50")),
  );
  const status = request.nextUrl.searchParams.get("status")?.trim();

  const logs = await prisma.gatewayRequestLog.findMany({
    where: {
      userId: user.id,
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { submittedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    logs: logs.map((l) => ({
      id: l.id,
      model: l.model,
      endpoint: l.endpoint,
      status: l.status,
      requestKind: l.requestKind,
      providerKind: l.providerKind,
      clientSource: l.clientSource,
      clientPage: l.clientPage,
      externalTaskId: l.externalTaskId,
      promptTokens: l.promptTokens,
      completionTokens: l.completionTokens,
      totalTokens: l.totalTokens,
      durationMs: l.durationMs,
      estimatedVendorCostYuan: l.estimatedVendorCostYuan?.toString() ?? null,
      failCode: l.failCode,
      failMessage: l.failMessage,
      inputSummary: l.inputSummary,
      resultSummary: l.resultSummary,
      submittedAt: l.submittedAt.toISOString(),
      completedAt: l.completedAt?.toISOString() ?? null,
    })),
  });
}
