import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
  mapGatewayPreCreateLogError,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import { forwardMinimaxGetVoice } from "@/lib/gateway/minimax-speech-proxy";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: { voice_type?: "system" | "voice_cloning" | "voice_generation" | "all" };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model: "MiniMax/get_voice",
      endpoint: "/v1/get_voice",
      providerKind: "MINIMAX",
      requestKind: "OTHER",
      clientSource,
      inputSummary: buildGatewayInputSummary("MiniMax/get_voice", body),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const result = await forwardMinimaxGetVoice({
      credentialId,
      voiceType: body.voice_type ?? "system",
    });
    const ok = result.status >= 200 && result.status < 300;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      resultSummary: ok
        ? { voiceCount: result.systemVoice.length }
        : undefined,
      failMessage: ok ? undefined : `HTTP ${result.status}`,
      model: "MiniMax/get_voice",
    });
    if (!ok) {
      return NextResponse.json({ error: `HTTP ${result.status}`, logId: log.id }, { status: 502 });
    }
    return NextResponse.json({
      system_voice: result.systemVoice,
      logId: log.id,
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: (e as Error).message,
      model: "MiniMax/get_voice",
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
