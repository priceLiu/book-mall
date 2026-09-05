/**
 * Gateway ASR 核心逻辑（HTTP route 与 book-mall 进程内电商拆解共用）。
 * 电商拆解走进程内路径，避免 dev 下 mall → localhost HTTP 自调用卡死、日志写不进去。
 */
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import {
  QWEN3_ASR_FLASH_FILETRANS_MODEL,
  dashscopeTranscribePublicFileUrl,
  isDashscopeAsrNoSpeechOutcome,
} from "@/lib/gateway/dashscope-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { audioDurationSecFromSentences } from "@/lib/finance/infer-asr-audio-duration";
import {
  logMetaToRequestLogFields,
  type GatewayV1LogMeta,
} from "@/lib/gateway/gateway-v1-log-meta";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  createRequestLog,
  finalizeRequestLog,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";

export class GatewayV1AsrError extends Error {
  readonly status: number;
  readonly logId?: string;
  constructor(status: number, message: string, logId?: string) {
    super(message);
    this.name = "GatewayV1AsrError";
    this.status = status;
    this.logId = logId;
  }
}

export async function runGatewayV1AsrTranscribe(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  fileUrl: string;
  model?: string;
  logMeta?: GatewayV1LogMeta;
}): Promise<{
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  logId: string;
  noSpeech: boolean;
}> {
  const fileUrl = opts.fileUrl.trim();
  if (!fileUrl) {
    throw new GatewayV1AsrError(400, "fileUrl required");
  }

  const credentialId = pickCredentialForKind(opts.auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    throw new GatewayV1AsrError(400, "No DASHSCOPE credential");
  }

  const model = opts.model?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL;
  const clientSource = parseGatewayClientSource(opts.logMeta?.clientSource);

  let log;
  try {
    log = await createRequestLog({
      userId: opts.auth.userId,
      apiKeyId: opts.auth.id,
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
      ...logMetaToRequestLogFields(opts.logMeta ?? {}),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    throw new GatewayV1AsrError(mapped.status, mapped.error);
  }

  const started = Date.now();
  try {
    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: "Credential unavailable",
        model,
      });
      throw new GatewayV1AsrError(400, "Credential unavailable", log.id);
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
        return { segments: [], logId: log.id, noSpeech: true };
      }
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.error,
        model,
      });
      throw new GatewayV1AsrError(502, result.error, log.id);
    }

    const segments = result.sentences.map((s) => ({
      startMs: s.beginMs,
      endMs: s.endMs,
      text: s.text,
    }));
    const speechDurationSec = audioDurationSecFromSentences(result.sentences);
    const audioDurationSec = result.billableAudioDurationSec ?? speechDurationSec;
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: {
        segmentCount: segments.length,
        audioDurationSec,
        sourceAudioDurationSec: audioDurationSec,
        speechDurationSec,
      },
      model,
    });
    return { segments, logId: log.id, noSpeech: segments.length === 0 };
  } catch (e) {
    if (e instanceof GatewayV1AsrError) throw e;
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: msg,
      model,
    });
    throw new GatewayV1AsrError(502, msg, log.id);
  }
}
