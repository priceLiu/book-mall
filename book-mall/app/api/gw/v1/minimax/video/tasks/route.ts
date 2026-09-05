import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { minimaxListVideoTasks } from "@/lib/gateway/minimax-video-client";
import { requireMinimaxVideoCredential } from "@/lib/gateway/minimax-video-gw-route";

export const dynamic = "force-dynamic";

/** GET · 查询 MiniMax H3 视频任务列表 */
export async function GET(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;

  const credOrErr = await requireMinimaxVideoCredential(authOrResp);
  if ("error" in credOrErr) {
    return NextResponse.json({ error: credOrErr.error }, { status: credOrErr.status });
  }

  const sp = request.nextUrl.searchParams;
  const query: Record<string, string | number | undefined> = {};
  for (const key of ["limit", "offset", "status", "model"]) {
    const v = sp.get(key);
    if (v) query[key] = key === "limit" || key === "offset" ? Number(v) : v;
  }

  try {
    const { raw } = await minimaxListVideoTasks({
      apiKey: credOrErr.cred.apiKey,
      baseUrl: credOrErr.cred.baseUrl,
      query,
    });
    return NextResponse.json(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "MiniMax list failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
