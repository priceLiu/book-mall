import { NextResponse, type NextRequest } from "next/server";

import {
  QWEN3_ASR_FLASH_FILETRANS_MODEL,
  dashscopeTranscribePublicFileUrl,
  isDashscopeAsrNoSpeechOutcome,
} from "@/lib/gateway/dashscope-client";
import { audioDurationSecFromSentences } from "@/lib/finance/infer-asr-audio-duration";
import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  createRequestLog,
  finalizeRequestLog,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    fileUrl?: string;
    audioUrl?: string;
    model?: string;
    modelKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fileUrl = String(body.fileUrl ?? body.audioUrl ?? "").trim();
  if (!fileUrl) {
    return NextResponse.json({ error: "fileUrl required" }, { status: 400 });
  }

  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    return NextResponse.json({ error: "No DASHSCOPE credential" }, { status: 400 });
  }

  const model =
    body.model?.trim() || body.modelKey?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL;
  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/dashscope/asr/transcribe",
      providerKind: "DASHSCOPE",
      requestKind: "OTHER",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, {
        fileUrl,
        canonicalModelKey: "qwen3-asr-flash-filetrans",
      }),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const started = Date.now();
  try {
    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      return NextResponse.json({ error: "Credential unavailable" }, { status: 400 });
    }
    const result = await dashscopeTranscribePublicFileUrl({
      apiKey: cred.apiKey,
      fileUrl,
      model,
    });
    if (!result.ok) {
      if (isDashscopeAsrNoSpeechOutcome(undefined, result.error, result.error)) {
        await finalizeRequestLog(log.id, {
          status: "SUCCEEDED",
          durationMs: Date.now() - started,
          resultSummary: { segmentCount: 0, noSpeech: true },
          model,
        });
        return NextResponse.json({
          code: 200,
          data: { segments: [] },
          logId: log.id,
          providerKind: "DASHSCOPE",
        });
      }
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.error,
        model,
      });
      return NextResponse.json({ error: result.error, logId: log.id }, { status: 502 });
    }
    const segments = result.sentences.map((s) => ({
      startMs: s.beginMs,
      endMs: s.endMs,
      text: s.text,
    }));
    const audioDurationSec = audioDurationSecFromSentences(result.sentences);
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: { segmentCount: segments.length, audioDurationSec },
      model,
    });
    return NextResponse.json({
      code: 200,
      data: { segments },
      logId: log.id,
      providerKind: "DASHSCOPE",
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: (e as Error).message,
      model,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
