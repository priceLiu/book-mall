import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { pickCredentialForKind } from "@/lib/gateway/proxy-common";
import { forwardMinimaxMusicCoverPreprocess } from "@/lib/gateway/minimax-music-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;

  let body: { audio_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const audioUrl = String(body.audio_url ?? "").trim();
  if (!audioUrl) return NextResponse.json({ error: "audio_url required" }, { status: 400 });

  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  const result = await forwardMinimaxMusicCoverPreprocess({ credentialId, audioUrl });
  if (result.status >= 400 || !result.processedUrl) {
    return NextResponse.json({ error: "MiniMax cover preprocess failed" }, { status: 502 });
  }
  return NextResponse.json({ processed_url: result.processedUrl });
}
