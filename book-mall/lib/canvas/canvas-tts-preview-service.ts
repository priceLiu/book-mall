import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";
import { canvasGwTts } from "@/lib/canvas/canvas-gateway-client";
import {
  resolveCanvasGatewayTtsExtras,
  resolveCanvasMinimaxTtsVoiceInput,
} from "@/lib/canvas/canvas-tts-run-params";
import { isPro2GatewaySyncTtsModelKey } from "@/lib/canvas/pro2-audio-tts-models";
import {
  assertGatewayApiKeyLinkedForUser,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { forwardMinimaxT2a } from "@/lib/gateway/minimax-speech-proxy";
import { isMinimaxSpeechModelKey } from "@/lib/gateway/minimax-speech-models";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayTtsResultSummary } from "@/lib/gateway/log-result-summary";
import { prisma } from "@/lib/prisma";

export const CANVAS_TTS_PREVIEW_TEXT_ZH = "你好，这是 MiniMax 语音试听。";
export const CANVAS_TTS_PREVIEW_TEXT_EN = "Hello, this is a MiniMax voice preview.";

export function resolveCanvasTtsPreviewText(
  params?: Record<string, unknown>,
): string {
  const lang = String(params?.language_type ?? "Chinese").trim();
  if (lang === "English") return CANVAS_TTS_PREVIEW_TEXT_EN;
  return CANVAS_TTS_PREVIEW_TEXT_ZH;
}

function stripCanvasTtsPreviewParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...params };
  delete out.voice_id;
  delete out.voice;
  delete out.voice_label;
  delete out.tts_param_preview_billing;
  return out;
}

async function readGatewayLogCreditsCharged(
  logId: string,
): Promise<number | undefined> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { creditsCharged: true },
  });
  if (log?.creditsCharged == null) return undefined;
  const n = Number(log.creditsCharged);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function previewMinimaxTts(args: {
  userId: string;
  modelKey: string;
  voiceId: string;
  text: string;
  params: Record<string, unknown>;
  projectId?: string;
  billable?: boolean;
}): Promise<{ buffer: Buffer; contentType: string; creditsCharged?: number }> {
  await assertGatewayApiKeyLinkedForUser(args.userId);
  const auth = await resolveGatewayAuthForBookUser(args.userId);
  if (!auth) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "请先在个人中心关联 Gateway API Key",
      503,
    );
  }
  const credentialId = pickCredentialForKind(auth.credentials, "MINIMAX");
  if (!credentialId) {
    throw new CanvasProjectError(
      "MODEL_NOT_AVAILABLE",
      "Gateway Key 未绑定 MiniMax 凭证",
      503,
    );
  }

  const voiceInput = resolveCanvasMinimaxTtsVoiceInput(
    args.params,
    args.voiceId,
    args.modelKey,
  );

  const gwClientPage = args.projectId
    ? `canvas/${args.projectId}/tts-preview`
    : "canvas/tts-preview";

  let logId: string | undefined;
  if (args.billable) {
    const log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model: args.modelKey,
      endpoint: "/v1/t2a_v2",
      providerKind: "MINIMAX",
      requestKind: "TTS",
      clientSource: "EXTERNAL",
      clientPage: gwClientPage,
      actorBookUserId: args.userId,
      inputSummary: {
        text: args.text,
        voice_id: args.voiceId,
        modelKey: args.modelKey,
        preview: true,
      },
    });
    logId = log.id;
  }

  const result = await forwardMinimaxT2a({
    credentialId,
    input: {
      modelKey: args.modelKey,
      text: args.text,
      ...voiceInput,
    },
  });

  const ok = result.status >= 200 && result.status < 300;
  let creditsCharged: number | undefined;

  if (logId) {
    await finalizeRequestLog(logId, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      failMessage: ok
        ? undefined
        : result.buffer.toString("utf8").slice(0, 500) ||
          `MiniMax 试听失败（HTTP ${result.status}）`,
      model: args.modelKey,
      resultSummary: ok
        ? buildGatewayTtsResultSummary({
            audioUrl: result.audioUrl,
            buffer: result.buffer,
            contentType: result.contentType?.trim() || "audio/mpeg",
            vendorJson: result.vendorJson,
          })
        : undefined,
    });
    if (ok) {
      creditsCharged = await readGatewayLogCreditsCharged(logId);
    }
  }

  if (!ok) {
    throw new CanvasProjectError(
      "UPSTREAM_ERROR",
      result.buffer.toString("utf8").slice(0, 200) ||
        `MiniMax 试听失败（HTTP ${result.status}）`,
      502,
    );
  }

  return {
    buffer: result.buffer,
    contentType: result.contentType?.trim() || "audio/mpeg",
    creditsCharged,
  };
}

async function previewGatewaySyncTts(args: {
  userId: string;
  modelKey: string;
  voiceId: string;
  text: string;
  params: Record<string, unknown>;
  projectId?: string;
  billable?: boolean;
}): Promise<{ buffer: Buffer; contentType: string; creditsCharged?: number }> {
  const extras = resolveCanvasGatewayTtsExtras(args.params);

  const out = await canvasGwTts(args.userId, {
    modelKey: args.modelKey,
    text: args.text,
    voice: args.voiceId,
    languageType: String(args.params.language_type ?? "").trim() || undefined,
    clientPage: args.projectId
      ? `canvas/${args.projectId}/tts-preview`
      : "canvas/tts-preview",
    projectId: args.projectId,
    extras: Object.keys(extras).length ? extras : undefined,
  });

  let creditsCharged: number | undefined;
  if (args.billable && out.logId) {
    creditsCharged = await readGatewayLogCreditsCharged(out.logId);
  }

  return {
    buffer: out.buffer,
    contentType: out.contentType || "audio/mpeg",
    creditsCharged,
  };
}

/** 画布 Dock · 按当前模型/音色/参数实时合成短试听（非 OSS 静态样音） */
export async function previewCanvasTtsSpeech(args: {
  userId: string;
  modelKey: string;
  voiceId: string;
  params?: Record<string, unknown>;
  text?: string;
  projectId?: string;
  billable?: boolean;
}): Promise<{
  dataUrl: string;
  contentType: string;
  creditsCharged?: number;
}> {
  const modelKey = args.modelKey.trim();
  const voiceId = args.voiceId.trim();
  if (!modelKey) {
    throw new CanvasProjectError("INVALID_INPUT", "modelKey required", 400);
  }
  if (!voiceId) {
    throw new CanvasProjectError("INVALID_INPUT", "voiceId required", 400);
  }

  const params = stripCanvasTtsPreviewParams(args.params ?? {});
  const text = (args.text?.trim() || resolveCanvasTtsPreviewText(params)).slice(
    0,
    120,
  );

  let audio: { buffer: Buffer; contentType: string; creditsCharged?: number };
  if (isMinimaxSpeechModelKey(modelKey)) {
    audio = await previewMinimaxTts({
      userId: args.userId,
      modelKey,
      voiceId,
      text,
      params,
      projectId: args.projectId,
      billable: args.billable,
    });
  } else if (isPro2GatewaySyncTtsModelKey(modelKey)) {
    audio = await previewGatewaySyncTts({
      userId: args.userId,
      modelKey,
      voiceId,
      text,
      params,
      projectId: args.projectId,
      billable: args.billable,
    });
  } else {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      `模型 ${modelKey} 不支持参数试听`,
      400,
    );
  }

  const b64 = audio.buffer.toString("base64");
  const contentType = audio.contentType || "audio/mpeg";
  return {
    contentType,
    dataUrl: `data:${contentType};base64,${b64}`,
    creditsCharged: audio.creditsCharged,
  };
}
