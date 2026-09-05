import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import {
  minimaxDeleteVideoTask,
  minimaxQueryVideoTask,
  minimaxVideoTaskResultUrl,
} from "@/lib/gateway/minimax-video-client";
import { requireMinimaxVideoCredential } from "@/lib/gateway/minimax-video-gw-route";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ taskId: string }> };

/** GET · 查询单个 MiniMax H3 视频任务 */
export async function GET(request: NextRequest, ctx: RouteCtx) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;

  const credOrErr = await requireMinimaxVideoCredential(authOrResp);
  if ("error" in credOrErr) {
    return NextResponse.json({ error: credOrErr.error }, { status: credOrErr.status });
  }

  const { taskId } = await ctx.params;
  if (!taskId?.trim()) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  try {
    const { task, raw } = await minimaxQueryVideoTask({
      apiKey: credOrErr.cred.apiKey,
      baseUrl: credOrErr.cred.baseUrl,
      taskId: taskId.trim(),
    });
    return NextResponse.json({ task, ...((raw as object) ?? {}) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MiniMax query failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** DELETE · 取消或删除 MiniMax H3 视频任务 */
export async function DELETE(request: NextRequest, ctx: RouteCtx) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;

  const credOrErr = await requireMinimaxVideoCredential(authOrResp);
  if ("error" in credOrErr) {
    return NextResponse.json({ error: credOrErr.error }, { status: credOrErr.status });
  }

  const { taskId } = await ctx.params;
  if (!taskId?.trim()) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  try {
    const { raw } = await minimaxDeleteVideoTask({
      apiKey: credOrErr.cred.apiKey,
      baseUrl: credOrErr.cred.baseUrl,
      taskId: taskId.trim(),
    });
    return NextResponse.json(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MiniMax delete failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

/** HEAD · 探测任务是否已有可下载视频 URL（不代理文件流） */
export async function HEAD(request: NextRequest, ctx: RouteCtx) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;

  const credOrErr = await requireMinimaxVideoCredential(authOrResp);
  if ("error" in credOrErr) {
    return new NextResponse(null, { status: credOrErr.status });
  }

  const { taskId } = await ctx.params;
  if (!taskId?.trim()) return new NextResponse(null, { status: 400 });

  try {
    const { task } = await minimaxQueryVideoTask({
      apiKey: credOrErr.cred.apiKey,
      baseUrl: credOrErr.cred.baseUrl,
      taskId: taskId.trim(),
    });
    const url = minimaxVideoTaskResultUrl(task);
    if (!url) return new NextResponse(null, { status: 404 });
    return new NextResponse(null, {
      status: 200,
      headers: { "x-minimax-video-url": url },
    });
  } catch {
    return new NextResponse(null, { status: 502 });
  }
}
