import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { forwardMinimaxMusicLyrics } from "@/lib/gateway/minimax-music-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;

  let body: { prompt?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  const result = await forwardMinimaxMusicLyrics({ credentialId, prompt });
  if (result.status >= 400) {
    return NextResponse.json({ error: "MiniMax lyrics failed" }, { status: 502 });
  }
  return NextResponse.json({ lyrics: result.lyrics });
}
