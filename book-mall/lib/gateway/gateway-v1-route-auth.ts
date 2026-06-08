import { NextResponse, type NextRequest } from "next/server";

import { resolveGatewayApiKeyFromAuthorization } from "@/lib/gateway/gateway-v1-auth";
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";

export async function requireGatewayV1Auth(
  request: NextRequest,
): Promise<ResolvedGatewayApiKeyAuth | NextResponse> {
  const auth = await resolveGatewayApiKeyFromAuthorization(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }
  return auth;
}

export function isGatewayAuthResponse(
  v: ResolvedGatewayApiKeyAuth | NextResponse,
): v is NextResponse {
  return v instanceof NextResponse;
}
