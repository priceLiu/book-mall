import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta } from "@/lib/gateway/gateway-v1-log-meta";
import {
  GatewayV1VolcengineImageError,
  runGatewayV1VolcengineImageGenerations,
} from "@/lib/gateway/gateway-v1-volcengine-image-service";
import type { VolcengineImageGenerationsParams } from "@/lib/gateway/volcengine-image-generations-proxy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;

  let body: {
    model?: string;
    prompt?: string;
    image?: string | string[];
    parameters?: VolcengineImageGenerationsParams;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const result = await runGatewayV1VolcengineImageGenerations({
      auth: authOrResp,
      body,
      logMeta: parseGatewayV1LogMeta(request),
    });
    return NextResponse.json({
      code: 200,
      data: {
        images: result.images,
        usage: result.usage,
        ...(result.layers?.length ? { layers: result.layers } : {}),
      },
      logId: result.logId,
      providerKind: "VOLCENGINE",
    });
  } catch (e) {
    if (e instanceof GatewayV1VolcengineImageError) {
      return NextResponse.json(
        { error: e.message, ...(e.logId ? { logId: e.logId } : {}) },
        { status: e.status },
      );
    }
    throw e;
  }
}
