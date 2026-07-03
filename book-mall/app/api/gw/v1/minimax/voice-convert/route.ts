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
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import { forwardMinimaxVoiceConvert } from "@/lib/gateway/minimax-speech-proxy";
import { MINIMAX_DEFAULT_SPEECH_MODEL_KEY } from "@/lib/gateway/minimax-speech-models";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    model?: string;
    source_audio_url?: string;
    audio_url?: string;
    voice_id?: string;
    stability?: number;
    similarity_boost?: number;
    style_exaggeration?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() || MINIMAX_DEFAULT_SPEECH_MODEL_KEY;
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  const sourceAudioUrl = String(body.source_audio_url ?? body.audio_url ?? "").trim();
  const voiceId = String(body.voice_id ?? "").trim();
  if (!sourceAudioUrl || !voiceId) {
    return NextResponse.json({ error: "source_audio_url and voice_id required" }, { status: 400 });
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  const payload = { model, source_audio_url: sourceAudioUrl, voice_id: voiceId };

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/voice_conversion",
      providerKind: "MINIMAX",
      requestKind: "TTS",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, payload),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const result = await forwardMinimaxVoiceConvert({
      credentialId,
      modelKey: model,
      sourceAudioUrl,
      voice_id: voiceId,
      stability: body.stability,
      similarity_boost: body.similarity_boost,
      style_exaggeration: body.style_exaggeration,
    });
    const ok = result.status >= 200 && result.status < 300;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      resultSummary: ok
        ? buildGatewayTaskResultSummary(result.vendorJson, {
            contentType: result.contentType,
            byteLength: result.buffer.length,
          })
        : undefined,
      failMessage: ok
        ? undefined
        : result.buffer.toString("utf8").slice(0, 500) || `HTTP ${result.status}`,
      model,
    });
    if (!ok) {
      return NextResponse.json(
        { error: `MiniMax voice convert HTTP ${result.status}`, logId: log.id },
        { status: 502 },
      );
    }
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": result.contentType,
        "X-Gateway-Log-Id": log.id,
        "X-Gateway-Audio-Ext": result.ext,
      },
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: (e as Error).message,
      model,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
