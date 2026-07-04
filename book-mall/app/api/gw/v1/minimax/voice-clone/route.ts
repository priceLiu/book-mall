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
import { forwardMinimaxVoiceClone } from "@/lib/gateway/minimax-speech-proxy";
import {
  MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
  isMinimaxVoiceCloneSpeechModelKey,
  resolveMinimaxUpstreamSpeechModel,
} from "@/lib/gateway/minimax-speech-models";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    model?: string;
    file_id?: number;
    voice_id?: string;
    text?: string;
    language_boost?: string;
    clone_prompt?: { prompt_audio?: number; prompt_text?: string };
    text_validation?: string;
    accuracy?: number;
    need_noise_reduction?: boolean;
    need_volume_normalization?: boolean;
    aigc_watermark?: boolean;
    voice_setting?: {
      emotion?: string;
      speed?: number;
      vol?: number;
      pitch?: number;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() || MINIMAX_DEFAULT_SPEECH_MODEL_KEY;
  if (!isMinimaxVoiceCloneSpeechModelKey(model)) {
    return NextResponse.json({ error: "Unsupported voice clone model" }, { status: 400 });
  }

  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    return NextResponse.json({ error: "No MINIMAX credential bound" }, { status: 400 });
  }

  const fileId = Number(body.file_id);
  const voiceId = String(body.voice_id ?? "").trim();
  if (!Number.isFinite(fileId) || fileId <= 0 || !voiceId) {
    return NextResponse.json({ error: "file_id and voice_id required" }, { status: 400 });
  }

  const text = String(body.text ?? "").trim();
  if (text && !body.model?.trim()) {
    return NextResponse.json({ error: "model required when text is provided" }, { status: 400 });
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  const payload = {
    model,
    file_id: fileId,
    voice_id: voiceId,
    text: text || undefined,
    language_boost: body.language_boost,
  };

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/voice_clone",
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

  const clonePrompt =
    body.clone_prompt?.prompt_audio && body.clone_prompt.prompt_text?.trim()
      ? {
          prompt_audio: Number(body.clone_prompt.prompt_audio),
          prompt_text: body.clone_prompt.prompt_text.trim(),
        }
      : undefined;

  const voiceSetting =
    body.voice_setting && (body.voice_setting.emotion || body.voice_setting.speed != null)
      ? {
          voice_id: voiceId,
          emotion: body.voice_setting.emotion,
          speed: body.voice_setting.speed,
          vol: body.voice_setting.vol,
          pitch: body.voice_setting.pitch,
        }
      : undefined;

  try {
    const result = await forwardMinimaxVoiceClone({
      credentialId,
      input: {
        file_id: fileId,
        voice_id: voiceId,
        text: text || undefined,
        model: resolveMinimaxUpstreamSpeechModel(model),
        language_boost: body.language_boost ?? "auto",
        clone_prompt: clonePrompt,
        text_validation: body.text_validation,
        accuracy: body.accuracy,
        need_noise_reduction: body.need_noise_reduction,
        need_volume_normalization: body.need_volume_normalization,
        aigc_watermark: body.aigc_watermark,
        voice_setting: voiceSetting,
      },
    });

    const ok = result.status >= 200 && result.status < 300;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      resultSummary: ok
        ? buildGatewayTaskResultSummary(result.vendorJson, {
            demo_audio: result.demoAudioUrl,
            voice_id: result.clonedVoiceId,
          })
        : undefined,
      failMessage: ok
        ? undefined
        : JSON.stringify(result.vendorJson).slice(0, 500) || `HTTP ${result.status}`,
      model,
    });

    if (!ok) {
      return NextResponse.json(
        { error: "MiniMax voice clone failed", logId: log.id, vendor: result.vendorJson },
        { status: 502 },
      );
    }

    return NextResponse.json({
      voice_id: result.clonedVoiceId,
      demo_audio: result.demoAudioUrl ?? "",
      logId: log.id,
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
