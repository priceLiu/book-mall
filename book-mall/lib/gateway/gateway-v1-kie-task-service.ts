/**
 * Gateway KIE createTask 核心逻辑（HTTP route 与 book-mall 进程内 Canvas 共用）。
 * Canvas 走进程内路径，避免 dev 下 mall → localhost HTTP 自调用在编译阻塞时 fetch failed。
 */
import type { ResolvedGatewayApiKeyAuth } from "@/lib/gateway/api-key-service";
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
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import {
  parseGatewayClientSource,
  submitKieJobForLog,
} from "@/lib/gateway/poll-service";
import { buildSubmitFailureFinalizePayload } from "@/lib/gateway/gateway-submit-error-policy";
import { prisma } from "@/lib/prisma";

export class GatewayV1KieTaskError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "GatewayV1KieTaskError";
    this.status = status;
  }
}

export async function runGatewayV1KieCreateTask(opts: {
  auth: ResolvedGatewayApiKeyAuth;
  body: {
    model: string;
    input: Record<string, unknown>;
    callBackUrl?: string | null;
  };
  logMeta?: GatewayV1LogMeta;
}): Promise<{ taskId: string; logId: string; providerKind: "KIE" }> {
  const model = opts.body.model.trim();
  if (!model) {
    throw new GatewayV1KieTaskError(400, "model required");
  }
  if (!opts.body.input || typeof opts.body.input !== "object") {
    throw new GatewayV1KieTaskError(400, "input required");
  }

  let route;
  try {
    route = routeGatewayModel(model);
  } catch (e) {
    if (e instanceof UnknownGatewayModelError) {
      throw new GatewayV1KieTaskError(400, e.message);
    }
    throw e;
  }
  if (route.providerKind !== "KIE") {
    throw new GatewayV1KieTaskError(
      400,
      `Model ${model} is not a KIE async job`,
    );
  }

  const credentialId = pickCredentialForKind(opts.auth.credentials, "KIE");
  if (!credentialId) {
    throw new GatewayV1KieTaskError(
      400,
      "No KIE credential bound to this API key",
    );
  }

  const clientSource = parseGatewayClientSource(opts.logMeta?.clientSource);
  const inputForLog = opts.body.input;

  let log;
  try {
    log = await createRequestLog({
      userId: opts.auth.userId,
      apiKeyId: opts.auth.id,
      credentialId,
      model,
      endpoint: "/v1/jobs/createTask",
      providerKind: "KIE",
      requestKind: route.requestKind,
      clientSource,
      inputSummary: buildGatewayInputSummary(model, inputForLog),
      ...logMetaToRequestLogFields(opts.logMeta ?? {}),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    throw new GatewayV1KieTaskError(mapped.status, mapped.error);
  }

  try {
    const taskId = await submitKieJobForLog({
      logId: log.id,
      credentialId,
      model,
      input: inputForLog,
      callBackUrl: opts.body.callBackUrl ?? null,
    });
    return { taskId, logId: log.id, providerKind: "KIE" };
  } catch (e) {
    const msg = (e as Error).message || "createTask failed";
    const row = await prisma.gatewayRequestLog.findUnique({
      where: { id: log.id },
      select: { status: true },
    });
    if (row?.status === "RUNNING") {
      const finalizePayload = await buildSubmitFailureFinalizePayload(e, {});
      await finalizeRequestLog(log.id, finalizePayload).catch(() => undefined);
    } else {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: 0,
        failMessage: msg.slice(0, 500),
        model,
      }).catch(() => undefined);
    }
    throw new GatewayV1KieTaskError(502, msg);
  }
}
