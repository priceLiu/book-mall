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
import { pickVolcengineCredentialForGatewayJob } from "@/lib/gateway/volcengine-credential-pick";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import {
  parseGatewayClientSource,
  submitBailianR2vJobForLog,
  submitDashscopeKlingV3ImageJobForLog,
  submitDashscopeTryOnJobForLog,
  submitDashscopeVideoJobForLog,
  submitDashscopeWan27ImageJobForLog,
  submitDashscopeWanxJobForLog,
  submitHunyuanJobForLog,
  submitKieJobForLog,
} from "@/lib/gateway/poll-service";
import { submitVolcengineVideoJobForLog } from "@/lib/gateway/volcengine-jobs";

export const dynamic = "force-dynamic";

const BAILIAN_R2V = new Set([
  "happyhorse-1.0-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
  "wan2.7-r2v",
]);

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    model?: string;
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
      jobKind?: "tryon" | "wanx" | "video" | "wan27-image" | "kling-v3-image";
      personImageUrl?: string;
      topGarmentUrl?: string;
      bottomGarmentUrl?: string;
      prompt?: string;
      negativePrompt?: string;
      n?: number;
      size?: string;
      refImg?: string;
      refMode?: "repaint" | "refonly";
      refStrength?: number;
      videoBody?: Record<string, unknown>;
      content?: Array<{ text: string } | { image: string }>;
      contentOrder?: "text-first" | "images-first";
      aspectRatio?: "16:9" | "9:16" | "1:1";
      resolution?: "1k" | "2k" | "4k";
    };
    hunyuan?: {
      prompt?: string;
      imageUrls?: string[];
      params?: Record<string, unknown>;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() ?? "";
  if (!model) {
    return NextResponse.json({ error: "model required" }, { status: 400 });
  }

  let route;
  try {
    route = routeGatewayModel(model);
  } catch (e) {
    if (e instanceof UnknownGatewayModelError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
  const credentialId =
    route.providerKind === "VOLCENGINE" && route.requestKind === "VIDEO"
      ? pickVolcengineCredentialForGatewayJob({
          credentials: auth.credentials,
          modelKey: model,
          clientPage: logMeta.clientPage,
          input: (body.input ?? null) as Record<string, unknown> | null,
        })
      : pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    return NextResponse.json(
      { error: `No ${route.providerKind} credential bound to this API key` },
      { status: 400 },
    );
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  const isBailianR2v =
    route.providerKind === "BAILIAN" && BAILIAN_R2V.has(model.toLowerCase());
  const b = body.bailian ?? {};
  const inputForLog: Record<string, unknown> = isBailianR2v
    ? {
        prompt: String(b.prompt ?? body.input?.prompt ?? "").trim(),
        referenceImageUrls: Array.isArray(b.referenceImageUrls)
          ? b.referenceImageUrls.filter((u): u is string => typeof u === "string")
          : [],
        resolution: b.resolution === "720P" ? "720P" : "1080P",
        ratio: String(b.ratio ?? "16:9"),
        duration: Number(b.duration ?? 5),
        ...(b.seedStr ? { seed: b.seedStr } : {}),
        ...(b.parameterExtras ?? {}),
      }
    : (body.input ?? {});

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/jobs/createTask",
      providerKind: route.providerKind,
      requestKind: route.requestKind,
      clientSource,
      inputSummary: buildGatewayInputSummary(model, inputForLog),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    if (route.providerKind === "HUNYUAN") {
      const h = body.hunyuan ?? {};
      const taskId = await submitHunyuanJobForLog({
        logId: log.id,
        credentialId,
        model,
        input: {
          prompt: String(h.prompt ?? body.input?.prompt ?? ""),
          imageUrls: Array.isArray(h.imageUrls)
            ? h.imageUrls.filter((u): u is string => typeof u === "string")
            : [],
          params: (h.params ?? body.input ?? {}) as Record<string, unknown>,
        },
      });
      return NextResponse.json({
        code: 200,
        data: { taskId, logId: log.id, providerKind: "HUNYUAN" },
      });
    }

    if (route.providerKind === "DASHSCOPE") {
      const ds = body.dashscope ?? {};
      const jobKind =
        ds.jobKind ??
        (route.requestKind === "TRYON"
          ? "tryon"
          : route.requestKind === "VIDEO"
            ? "video"
            : "wanx");

      if (jobKind === "tryon") {
        const personImageUrl = String(
          ds.personImageUrl ?? body.input?.person_image_url ?? "",
        ).trim();
        if (!personImageUrl) {
          return NextResponse.json({ error: "personImageUrl required" }, { status: 400 });
        }
        const taskId = await submitDashscopeTryOnJobForLog({
          logId: log.id,
          credentialId,
          model,
          personImageUrl,
          topGarmentUrl:
            typeof ds.topGarmentUrl === "string" ? ds.topGarmentUrl : undefined,
          bottomGarmentUrl:
            typeof ds.bottomGarmentUrl === "string" ? ds.bottomGarmentUrl : undefined,
        });
        return NextResponse.json({
          code: 200,
          data: { taskId, logId: log.id, providerKind: "DASHSCOPE" },
        });
      }

      if (jobKind === "video") {
        const videoBody = (ds.videoBody ?? body.input ?? {}) as Record<string, unknown>;
        const taskId = await submitDashscopeVideoJobForLog({
          logId: log.id,
          credentialId,
          model,
          body: videoBody,
        });
        return NextResponse.json({
          code: 200,
          data: { taskId, logId: log.id, providerKind: "DASHSCOPE" },
        });
      }

      if (jobKind === "wan27-image") {
        const content = Array.isArray(ds.content) ? ds.content : [];
        const taskId = await submitDashscopeWan27ImageJobForLog({
          logId: log.id,
          credentialId,
          model,
          content,
          size: typeof ds.size === "string" ? ds.size : undefined,
          n: Number(ds.n ?? 1),
          contentOrder: ds.contentOrder,
        });
        return NextResponse.json({
          code: 200,
          data: { taskId, logId: log.id, providerKind: "DASHSCOPE" },
        });
      }

      if (jobKind === "kling-v3-image") {
        const content = Array.isArray(ds.content) ? ds.content : [];
        const taskId = await submitDashscopeKlingV3ImageJobForLog({
          logId: log.id,
          credentialId,
          model,
          content,
          aspectRatio: ds.aspectRatio,
          resolution: ds.resolution,
          n: Number(ds.n ?? 1),
        });
        return NextResponse.json({
          code: 200,
          data: { taskId, logId: log.id, providerKind: "DASHSCOPE" },
        });
      }

      const prompt = String(ds.prompt ?? body.input?.prompt ?? "").trim();
      if (!prompt) {
        return NextResponse.json({ error: "prompt required" }, { status: 400 });
      }
      const taskId = await submitDashscopeWanxJobForLog({
        logId: log.id,
        credentialId,
        model,
        prompt,
        negativePrompt:
          typeof ds.negativePrompt === "string" ? ds.negativePrompt : undefined,
        n: Number(ds.n ?? body.input?.n ?? 1),
        size: typeof ds.size === "string" ? ds.size : undefined,
        refImg: typeof ds.refImg === "string" ? ds.refImg : undefined,
        refMode: ds.refMode,
        refStrength:
          typeof ds.refStrength === "number" ? ds.refStrength : undefined,
      });
      return NextResponse.json({
        code: 200,
        data: { taskId, logId: log.id, providerKind: "DASHSCOPE" },
      });
    }

    if (route.providerKind === "VOLCENGINE" && route.requestKind === "VIDEO") {
      const volcBody = (body.input ?? {}) as Record<string, unknown>;
      const taskId = await submitVolcengineVideoJobForLog({
        logId: log.id,
        credentialId,
        model,
        body: volcBody,
      });
      return NextResponse.json({
        code: 200,
        data: { taskId, logId: log.id, providerKind: "VOLCENGINE" },
      });
    }

    if (isBailianR2v) {
      const prompt = String(inputForLog.prompt ?? "").trim();
      const referenceImageUrls = Array.isArray(inputForLog.referenceImageUrls)
        ? inputForLog.referenceImageUrls.filter(
            (u): u is string => typeof u === "string",
          )
        : [];
      const resolution =
        inputForLog.resolution === "720P" ? "720P" : "1080P";
      const taskId = await submitBailianR2vJobForLog({
        logId: log.id,
        credentialId,
        model,
        prompt,
        referenceImageUrls,
        resolution,
        ratio: String(inputForLog.ratio ?? "16:9"),
        duration: Number(inputForLog.duration ?? 5),
        seedStr: typeof b.seedStr === "string" ? b.seedStr : undefined,
        parameterExtras: b.parameterExtras,
      });
      return NextResponse.json({
        code: 200,
        data: { taskId, logId: log.id, providerKind: "BAILIAN" },
      });
    }

    if (route.providerKind !== "KIE" || !body.input) {
      return NextResponse.json(
        { error: "KIE credential and input required for async jobs" },
        { status: 400 },
      );
    }

    const taskId = await submitKieJobForLog({
      logId: log.id,
      credentialId,
      model,
      input: body.input,
      callBackUrl: body.callBackUrl ?? null,
    });
    return NextResponse.json({
      code: 200,
      data: { taskId, logId: log.id, providerKind: "KIE" },
    });
  } catch (e) {
    const msg = (e as Error).message || "createTask failed";
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failMessage: msg.slice(0, 500),
      failCode: "UPSTREAM_SUBMIT_FAILED",
    }).catch(() => undefined);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
