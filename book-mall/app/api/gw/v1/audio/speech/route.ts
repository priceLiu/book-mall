import { NextResponse, type NextRequest } from "next/server";
import { resolveGatewayApiKeyFromBearer } from "@/lib/gateway/api-key-service";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardAudioSpeech,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayTaskResultSummary } from "@/lib/gateway/log-result-summary";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { routeGatewayModel } from "@/lib/gateway/model-router";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await resolveGatewayApiKeyFromBearer(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  let body: {
    model?: string;
    input?: string;
    voice?: string;
    response_format?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() || "tts-1";
  const route = routeGatewayModel(model);
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    return NextResponse.json(
      { error: `No ${route.providerKind} credential bound` },
      { status: 400 },
    );
  }

  const input = String(body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  const clientSource = parseGatewayClientSource(
    request.headers.get("x-gateway-client"),
  );

  const payload = {
    model,
    input: input.slice(0, 4096),
    voice: body.voice ?? "alloy",
    response_format: body.response_format ?? "mp3",
  };

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/audio/speech",
    providerKind: route.providerKind,
    requestKind: "TTS",
    clientSource,
    inputSummary: buildGatewayInputSummary(model, payload),
  });

  try {
    const result = await forwardAudioSpeech({
      credentialId,
      providerKind: route.providerKind,
      body: payload,
    });
    const ok = result.status >= 200 && result.status < 300;
    const usage = result.vendorJson ? parseOpenAiUsage(result.vendorJson) : undefined;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      usage,
      resultSummary: ok
        ? buildGatewayTaskResultSummary(result.vendorJson, {
            contentType: "audio/mpeg",
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
        { error: `TTS HTTP ${result.status}`, logId: log.id },
        { status: 502 },
      );
    }
    return new NextResponse(new Uint8Array(result.buffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "X-Gateway-Log-Id": log.id,
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
