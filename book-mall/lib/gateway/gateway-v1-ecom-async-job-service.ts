/**
 * 电商逐镜/成片 · Gateway createTask 进程内实现。
 * 避免 dev 下 book-mall 长请求（panel/generate）HTTP 自调 /api/gw/v1/jobs/createTask 卡死、日志写不进去。
 */
import type { GatewayProviderKind } from "@prisma/client";
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
import { buildBailianR2vRequestBody, enrichBailianR2vInputForLog } from "@/lib/canvas/bailian-r2v-body";
import { pickAiSpaceS2vCredentialId } from "@/lib/ai-space/ai-space-gateway-auth";
import { isDashscopeWan30VideoModelKey } from "@/lib/gateway/dashscope-client";
import {
  logMetaToRequestLogFields,
  type GatewayV1LogMeta,
} from "@/lib/gateway/gateway-v1-log-meta";
import { buildGatewayInputSummary, buildDashscopeCreateTaskInputForLog } from "@/lib/gateway/log-input-summary";
import { runGatewayV1KieCreateTask, GatewayV1KieTaskError } from "@/lib/gateway/gateway-v1-kie-task-service";
import {
  isBailianR2vGatewayModel,
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import {
  createRequestLog,
  finalizeRequestLog,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import {
  parseGatewayClientSource,
  submitBailianR2vJobForLog,
  submitDashscopeVideoJobForLog,
} from "@/lib/gateway/poll-service";
import { submitMinimaxVideoJobForLog } from "@/lib/gateway/minimax-video-jobs";
import { submitVolcengineVideoJobForLog } from "@/lib/gateway/volcengine-jobs";
import { pickVolcengineCredentialForGatewayJob } from "@/lib/gateway/volcengine-credential-pick";
import { buildSubmitFailureFinalizePayload } from "@/lib/gateway/gateway-submit-error-policy";
import { prisma } from "@/lib/prisma";

export class GatewayV1EcomAsyncJobError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GatewayV1EcomAsyncJobError";
    this.status = status;
  }
}

export type GatewayV1EcomCreateTaskBody = {
  model?: string;
  gatewayModelKey?: string;
  input?: Record<string, unknown>;
  callBackUrl?: string | null;
  bailian?: {
    prompt?: string;
    referenceImageUrls?: string[];
    resolution?: "720P" | "1080P";
    ratio?: string;
    duration?: number;
    seedStr?: string;
    parameterExtras?: Record<string, unknown>;
  };
  dashscope?: {
    jobKind?: "video" | "wanx" | "wan27-image" | "kling-v3-image" | "multimodal-image-sync" | "tryon";
    videoBody?: Record<string, unknown>;
    prompt?: string;
    negativePrompt?: string;
    n?: number;
    size?: string;
    refImg?: string;
    refMode?: "repaint" | "refonly";
    refStrength?: number;
    content?: Array<{ text: string } | { image: string }>;
    contentOrder?: "text-first" | "images-first";
    aspectRatio?: "16:9" | "9:16" | "1:1";
    resolution?: "1k" | "2k" | "4k";
    parameters?: Record<string, unknown>;
    personImageUrl?: string;
    topGarmentUrl?: string;
    bottomGarmentUrl?: string;
  };
};

export type PreparedGatewayV1EcomAsyncJob = {
  logId: string;
  credentialId: string;
  model: string;
  providerKind: string;
  route: ReturnType<typeof routeGatewayModel>;
  isBailianR2vModel: boolean;
};

function buildInputForLog(
  body: GatewayV1EcomCreateTaskBody,
  model: string,
  isBailianR2vModel: boolean,
): Record<string, unknown> {
  const b = body.bailian ?? {};
  const dsForLog = body.dashscope as Record<string, unknown> | undefined;
  if (isBailianR2vModel) {
    const prompt = String(b.prompt ?? body.input?.prompt ?? "").trim();
    const referenceImageUrls = Array.isArray(b.referenceImageUrls)
      ? b.referenceImageUrls.filter((u): u is string => typeof u === "string")
      : [];
    const resolution = b.resolution === "720P" ? "720P" : "1080P";
    const ratio = String(b.ratio ?? "16:9");
    const duration = Number(b.duration ?? 5);
    const built = buildBailianR2vRequestBody({
      model,
      prompt,
      referenceImageUrls,
      resolution,
      ratio,
      duration,
      seedStr: typeof b.seedStr === "string" ? b.seedStr : undefined,
      parameterExtras: b.parameterExtras,
    });
    return enrichBailianR2vInputForLog(built, referenceImageUrls);
  }
  if (dsForLog && typeof dsForLog === "object") {
    return buildDashscopeCreateTaskInputForLog(
      dsForLog,
      body.input as Record<string, unknown> | undefined,
    );
  }
  return body.input ?? {};
}

async function resolveEcomAsyncJobCredential(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: GatewayV1EcomCreateTaskBody;
  logMeta?: GatewayV1LogMeta;
  model: string;
  route: ReturnType<typeof routeGatewayModel>;
  isBailianR2vModel: boolean;
  effectiveRoute: { providerKind: string; requestKind: string };
}): Promise<string> {
  let credentialId =
    opts.route.providerKind === "VOLCENGINE" &&
    opts.route.requestKind === "VIDEO" &&
    !opts.isBailianR2vModel
      ? pickVolcengineCredentialForGatewayJob({
          credentials: opts.auth.credentials,
          modelKey: opts.model,
          clientPage: opts.logMeta?.clientPage,
          input: (opts.body.input ?? null) as Record<string, unknown> | null,
        })
      : pickCredentialForKind(
          opts.auth.credentials,
          opts.effectiveRoute.providerKind as GatewayProviderKind,
        );
  if (isDashscopeWan30VideoModelKey(opts.model)) {
    credentialId = (await pickAiSpaceS2vCredentialId(opts.auth)) ?? credentialId;
  }
  if (!credentialId) {
    throw new GatewayV1EcomAsyncJobError(
      400,
      `No ${opts.effectiveRoute.providerKind} credential bound to this API key`,
    );
  }
  return credentialId;
}

/** 先写 GatewayRequestLog（RUNNING），再去做参考图预处理 / 厂商 submit */
export async function prepareGatewayV1EcomAsyncJobLog(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: GatewayV1EcomCreateTaskBody;
  logMeta?: GatewayV1LogMeta;
}): Promise<PreparedGatewayV1EcomAsyncJob> {
  const kieUpstreamModel = opts.body.model?.trim() ?? "";
  const gatewayModelKey = opts.body.gatewayModelKey?.trim() || kieUpstreamModel;
  if (!kieUpstreamModel) {
    throw new GatewayV1EcomAsyncJobError(400, "model required");
  }
  const model = gatewayModelKey;

  let route;
  try {
    route = routeGatewayModel(gatewayModelKey);
  } catch (e) {
    if (e instanceof UnknownGatewayModelError) {
      throw new GatewayV1EcomAsyncJobError(400, e.message);
    }
    throw e;
  }

  const isBailianR2vModel = isBailianR2vGatewayModel(model);
  const effectiveRoute = isBailianR2vModel
    ? ({ providerKind: "BAILIAN", requestKind: "VIDEO" } as const)
    : route;

  if (route.providerKind === "KIE") {
    throw new GatewayV1EcomAsyncJobError(400, "KIE 任务不支持 prepare/submit 分步");
  }

  const credentialId = await resolveEcomAsyncJobCredential({
    auth: opts.auth,
    body: opts.body,
    logMeta: opts.logMeta,
    model,
    route,
    isBailianR2vModel,
    effectiveRoute,
  });

  const clientSource = parseGatewayClientSource(opts.logMeta?.clientSource);
  const inputForLog = buildInputForLog(opts.body, model, isBailianR2vModel);

  let log;
  try {
    log = await createRequestLog({
      userId: opts.auth.userId,
      apiKeyId: opts.auth.id,
      credentialId,
      model,
      endpoint: "/v1/jobs/createTask",
      providerKind: effectiveRoute.providerKind,
      requestKind: effectiveRoute.requestKind,
      clientSource,
      inputSummary: buildGatewayInputSummary(model, inputForLog),
      ...logMetaToRequestLogFields(opts.logMeta ?? {}),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    throw new GatewayV1EcomAsyncJobError(mapped.status, mapped.error);
  }

  return {
    logId: log.id,
    credentialId,
    model,
    providerKind: effectiveRoute.providerKind,
    route,
    isBailianR2vModel,
  };
}

export async function submitGatewayV1EcomAsyncJobWithLog(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  prepared: PreparedGatewayV1EcomAsyncJob;
  body: GatewayV1EcomCreateTaskBody;
}): Promise<{ taskId: string; logId: string; providerKind: string }> {
  const { prepared } = opts;
  const { logId, credentialId, model, route, isBailianR2vModel } = prepared;
  const b = opts.body.bailian ?? {};

  try {
    if (isBailianR2vModel) {
      const prompt = String(b.prompt ?? opts.body.input?.prompt ?? "").trim();
      const referenceImageUrls = Array.isArray(b.referenceImageUrls)
        ? b.referenceImageUrls.filter((u): u is string => typeof u === "string")
        : [];
      if (!prompt) {
        throw new GatewayV1EcomAsyncJobError(400, "bailian prompt required");
      }
      if (referenceImageUrls.length < 1) {
        throw new GatewayV1EcomAsyncJobError(400, "bailian referenceImageUrls required (1–9)");
      }
      const resolution = b.resolution === "720P" ? "720P" : "1080P";
      const taskId = await submitBailianR2vJobForLog({
        logId,
        credentialId,
        model,
        prompt,
        referenceImageUrls,
        resolution,
        ratio: String(b.ratio ?? "16:9"),
        duration: Number(b.duration ?? 5),
        seedStr: typeof b.seedStr === "string" ? b.seedStr : undefined,
        parameterExtras: b.parameterExtras,
      });
      return { taskId, logId, providerKind: "BAILIAN" };
    }

    if (route.providerKind === "DASHSCOPE") {
      const ds = opts.body.dashscope ?? {};
      const jobKind = ds.jobKind ?? (route.requestKind === "VIDEO" ? "video" : "wanx");
      if (jobKind !== "video") {
        throw new GatewayV1EcomAsyncJobError(400, "电商视频仅支持 dashscope jobKind=video");
      }
      const videoBody = (ds.videoBody ?? opts.body.input ?? {}) as Record<string, unknown>;
      const taskId = await submitDashscopeVideoJobForLog({
        logId,
        credentialId,
        model,
        body: videoBody,
      });
      return { taskId, logId, providerKind: "DASHSCOPE" };
    }

    if (route.providerKind === "VOLCENGINE" && route.requestKind === "VIDEO") {
      const volcBody = (opts.body.input ?? {}) as Record<string, unknown>;
      const taskId = await submitVolcengineVideoJobForLog({
        logId,
        credentialId,
        model,
        body: volcBody,
      });
      return { taskId, logId, providerKind: "VOLCENGINE" };
    }

    if (route.providerKind === "MINIMAX" && route.requestKind === "VIDEO") {
      const minimaxInput = (opts.body.input ?? {}) as Record<string, unknown>;
      const taskId = await submitMinimaxVideoJobForLog({
        logId,
        credentialId,
        model,
        input: minimaxInput,
      });
      return { taskId, logId, providerKind: "MINIMAX" };
    }

    throw new GatewayV1EcomAsyncJobError(400, "Unsupported async job provider");
  } catch (e) {
    if (e instanceof GatewayV1EcomAsyncJobError) throw e;
    const msg = (e as Error).message || "createTask failed";
    const row = await prisma.gatewayRequestLog.findUnique({
      where: { id: logId },
      select: { status: true },
    });
    if (row?.status === "RUNNING") {
      const finalizePayload = await buildSubmitFailureFinalizePayload(e, {});
      await finalizeRequestLog(logId, finalizePayload).catch(() => undefined);
    } else {
      await finalizeRequestLog(logId, {
        status: "FAILED",
        durationMs: 0,
        failMessage: msg.slice(0, 500),
        model,
      }).catch(() => undefined);
    }
    throw new GatewayV1EcomAsyncJobError(502, msg);
  }
}

export async function runGatewayV1EcomAsyncJobCreateTask(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: GatewayV1EcomCreateTaskBody;
  logMeta?: GatewayV1LogMeta;
}): Promise<{ taskId: string; logId: string; providerKind: string }> {
  const kieUpstreamModel = opts.body.model?.trim() ?? "";
  const gatewayModelKey = opts.body.gatewayModelKey?.trim() || kieUpstreamModel;
  if (!kieUpstreamModel) {
    throw new GatewayV1EcomAsyncJobError(400, "model required");
  }
  const model = gatewayModelKey;

  let route;
  try {
    route = routeGatewayModel(gatewayModelKey);
  } catch (e) {
    if (e instanceof UnknownGatewayModelError) {
      throw new GatewayV1EcomAsyncJobError(400, e.message);
    }
    throw e;
  }

  if (route.providerKind === "KIE") {
    if (!opts.body.input) {
      throw new GatewayV1EcomAsyncJobError(400, "KIE credential and input required for async jobs");
    }
    try {
      const created = await runGatewayV1KieCreateTask({
        auth: opts.auth,
        body: {
          model: kieUpstreamModel,
          gatewayModelKey,
          input: opts.body.input,
          callBackUrl: opts.body.callBackUrl ?? null,
        },
        logMeta: opts.logMeta,
      });
      return {
        taskId: created.taskId,
        logId: created.logId,
        providerKind: created.providerKind,
      };
    } catch (e) {
      const msg = e instanceof GatewayV1KieTaskError ? e.message : (e as Error).message;
      throw new GatewayV1EcomAsyncJobError(
        e instanceof GatewayV1KieTaskError ? e.status : 502,
        msg || "createTask failed",
      );
    }
  }

  const prepared = await prepareGatewayV1EcomAsyncJobLog(opts);
  return submitGatewayV1EcomAsyncJobWithLog({
    auth: opts.auth,
    prepared,
    body: opts.body,
  });
}
