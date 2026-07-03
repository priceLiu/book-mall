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
import { forwardMinimaxMusicGenerate } from "@/lib/gateway/minimax-music-proxy";
import { MINIMAX_DEFAULT_MUSIC_MODEL_KEY } from "@/lib/gateway/minimax-speech-models";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    model?: string;
    prompt?: string;
    lyrics?: string;
    duration?: number;
    durationSeconds?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() || MINIMAX_DEFAULT_MUSIC_MODEL_KEY;
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  const payload = {
    model,
    prompt,
    lyrics: body.lyrics,
    duration: body.durationSeconds ?? body.duration,
  };

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/music_generation",
      providerKind: "MINIMAX",
      requestKind: "MUSIC",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, payload),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const result = await forwardMinimaxMusicGenerate({
      credentialId,
      input: {
        modelKey: model,
        prompt,
        lyrics: body.lyrics,
        durationSeconds: body.durationSeconds ?? body.duration,
      },
    });
    const ok = result.status >= 200 && result.status < 300 && !!result.buffer?.length;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : result.taskId ? "RUNNING" : "FAILED",
      durationMs: result.durationMs,
      externalTaskId: result.taskId,
      resultSummary: ok
        ? buildGatewayTaskResultSummary(result.vendorJson, {
            contentType: "audio/mpeg",
            byteLength: result.buffer?.length ?? 0,
          })
        : undefined,
      failMessage: ok ? undefined : `HTTP ${result.status}`,
      model,
    });
    if (result.taskId && !ok) {
      return NextResponse.json({ taskId: result.taskId, logId: log.id, status: "RUNNING" });
    }
    if (!ok || !result.buffer) {
      return NextResponse.json(
        { error: `MiniMax music HTTP ${result.status}`, logId: log.id },
        { status: 502 },
      );
    }
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Gateway-Log-Id": log.id,
        "X-Gateway-Audio-Ext": "mp3",
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
