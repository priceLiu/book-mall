import { prisma } from "@/lib/prisma";
import { extractQrJobOutputUrl } from "@/lib/quick-replica/qr-job-output";
import { qrCreateMinimaxVoiceCloneJob } from "@/lib/quick-replica/qr-text-to-audio-service";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";
import { validateVoiceCloneDraft } from "@/lib/quick-replica/qr-voice-clone-models";
import { MINIMAX_DEFAULT_SPEECH_MODEL_KEY } from "@/lib/gateway/minimax-speech-models";
import { shouldCanvasUseGateway } from "@/lib/canvas/canvas-gateway-run";
import { GATEWAY_MINIMAX_VIDEO_PROVIDER_ID } from "@/lib/canvas/canvas-gateway-providers";
import { CanvasProjectError } from "@/lib/canvas/canvas-project-service";

export type CanvasVoiceCloneInput = {
  referenceAudioUrl: string;
  prompt: string;
  /** 克隆音色展示名（「我的克隆音色」列表） */
  title: string;
};

export type CanvasVoiceCloneResult = {
  audioUrl: string;
  voiceId: string;
  logId: string;
};

function readVoiceIdFromLog(resultSummary: unknown): string {
  if (!resultSummary || typeof resultSummary !== "object") return "";
  const r = resultSummary as Record<string, unknown>;
  return (
    (typeof r.voice_id === "string" ? r.voice_id.trim() : "") ||
    (typeof r.voiceId === "string" ? r.voiceId.trim() : "")
  );
}

function buildVoiceCloneDraft(input: CanvasVoiceCloneInput): QrWorkspaceDraft {
  return {
    category: "audio",
    kind: "voice-clone",
    title: input.title.trim(),
    targetImageUrl: "",
    referenceVideoUrl: "",
    referenceAudioUrl: input.referenceAudioUrl.trim(),
    sceneImageUrls: [],
    prompt: input.prompt.trim(),
    modelKey: MINIMAX_DEFAULT_SPEECH_MODEL_KEY,
    languageBoost: "auto",
    needNoiseReduction: false,
    needVolumeNormalization: false,
    aigcWatermark: false,
    voiceEmotions: {
      happy: 0,
      angry: 0,
      sad: 0,
      fearful: 0,
      disgusted: 0,
      calm: 0,
      surprised: 0,
      neutral: 0,
    },
  };
}

/** 画布 · 从参考音频复刻 MiniMax 音色并返回试听 URL */
export async function runCanvasVoiceClone(
  userId: string,
  input: CanvasVoiceCloneInput,
): Promise<CanvasVoiceCloneResult> {
  const referenceAudioUrl = input.referenceAudioUrl.trim();
  const title = input.title.trim();
  const prompt = input.prompt.trim();
  if (!referenceAudioUrl || !/^https?:\/\//i.test(referenceAudioUrl)) {
    throw new CanvasProjectError(
      "INVALID_INPUT",
      "参考音频须为已上传的 HTTPS 地址",
      400,
    );
  }
  if (!title) {
    throw new CanvasProjectError("INVALID_INPUT", "请填写音色名称", 400);
  }
  const draft = buildVoiceCloneDraft({ referenceAudioUrl, prompt, title });
  const validationError = validateVoiceCloneDraft({
    modelKey: draft.modelKey,
    referenceAudioUrl: draft.referenceAudioUrl,
    prompt: draft.prompt,
  });
  if (validationError) {
    throw new CanvasProjectError("INVALID_INPUT", validationError, 400);
  }

  await shouldCanvasUseGateway(
    userId,
    GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
    draft.modelKey,
  );

  const { logId } = await qrCreateMinimaxVoiceCloneJob(userId, draft);
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { status: true, resultSummary: true, failMessage: true },
  });
  if (!log || log.status !== "SUCCEEDED") {
    throw new CanvasProjectError(
      "UPSTREAM_ERROR",
      log?.failMessage?.trim() || "音色克隆失败",
      502,
    );
  }

  const extracted = extractQrJobOutputUrl(log.resultSummary);
  const audioUrl = extracted?.url?.trim() ?? "";
  const voiceId = readVoiceIdFromLog(log.resultSummary);
  if (!audioUrl || !voiceId) {
    throw new CanvasProjectError(
      "UPSTREAM_ERROR",
      "克隆已完成但未返回音频或 voice_id",
      502,
    );
  }

  return { audioUrl, voiceId, logId };
}
