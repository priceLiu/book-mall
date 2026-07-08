import { prisma } from "@/lib/prisma";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import {
  parseTopazFilterModel,
  parseTopazFrameInterpolation,
  parseTopazSlowmoFactor,
  parseTopazUpscaleFactor,
  topazUpscaleFromHdResolution,
  topazCreateExpressVideoRequest,
  topazDownloadSourceVideo,
  topazGetVideoStatus,
  topazUploadVideoToSignedUrl,
  isTopazVideoStatusFailed,
  isTopazVideoStatusInProgress,
  isTopazVideoStatusSuccess,
  topazVideoStatusDownloadUrl,
  type TopazVideoStatusResponse,
} from "@/lib/gateway/topaz-client";

export type TopazPollResult = {
  state: "pending" | "running" | "succeeded" | "failed";
  downloadUrl?: string;
  progress?: number;
  errorMessage?: string;
  raw: TopazVideoStatusResponse;
};

export async function submitTopazVideoJobForLog(opts: {
  logId: string;
  credentialId: string;
  model: string;
  input: {
    videoUrl?: string;
    video_url?: string;
    filterModel?: string;
    filter_model?: string;
    upscaleFactor?: number | string;
    upscale_factor?: number | string;
    slowmo?: number | string;
    frameInterpolation?: string;
    frame_interpolation?: string;
    resolution?: string;
  };
}): Promise<string> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred?.apiKey?.trim()) throw new Error("Topaz 凭证不可用");

  const videoUrl = String(
    opts.input.videoUrl ?? opts.input.video_url ?? "",
  ).trim();
  if (!videoUrl) throw new Error("video_url required");

  const filterModel = parseTopazFilterModel(
    opts.input.filterModel ?? opts.input.filter_model,
  );
  const upscaleFactor =
    opts.input.upscaleFactor != null || opts.input.upscale_factor != null
      ? parseTopazUpscaleFactor(
          opts.input.upscaleFactor ?? opts.input.upscale_factor,
        )
      : topazUpscaleFromHdResolution(opts.input.resolution);
  const slowmo = parseTopazSlowmoFactor(opts.input.slowmo);
  const frameInterpolation = parseTopazFrameInterpolation(
    opts.input.frameInterpolation ?? opts.input.frame_interpolation,
  );

  const { bytes, contentType } = await topazDownloadSourceVideo(videoUrl);
  const created = await topazCreateExpressVideoRequest({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    filterModel,
    upscaleFactor,
    slowmo,
    frameInterpolation,
  });

  await topazUploadVideoToSignedUrl({
    uploadUrl: created.uploadUrls![0]!,
    videoBytes: bytes,
    contentType,
  });

  await prisma.gatewayRequestLog.update({
    where: { id: opts.logId },
    data: {
      externalTaskId: created.requestId,
      status: "RUNNING",
    },
  });

  return created.requestId;
}

export async function pollTopazVideoTaskForLog(opts: {
  credentialId: string;
  taskId: string;
}): Promise<TopazPollResult> {
  const cred = await getDecryptedCredentialApiKey(opts.credentialId);
  if (!cred?.apiKey?.trim()) throw new Error("Topaz 凭证不可用");

  const raw = await topazGetVideoStatus({
    apiKey: cred.apiKey,
    baseUrl: cred.baseUrl,
    requestId: opts.taskId,
  });

  if (isTopazVideoStatusSuccess(raw)) {
    return {
      state: "succeeded",
      downloadUrl: topazVideoStatusDownloadUrl(raw) ?? undefined,
      progress: 100,
      raw,
    };
  }
  if (isTopazVideoStatusFailed(raw)) {
    return {
      state: "failed",
      errorMessage: raw.message ?? raw.error ?? "Topaz video processing failed",
      raw,
    };
  }
  if (isTopazVideoStatusInProgress(raw)) {
    return {
      state: "running",
      progress: typeof raw.progress === "number" ? raw.progress : undefined,
      raw,
    };
  }
  return { state: "pending", raw };
}
