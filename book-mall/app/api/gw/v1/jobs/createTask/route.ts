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
import { buildBailianR2vRequestBody } from "@/lib/canvas/bailian-r2v-body";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
  isBailianR2vGatewayModel,
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
} from "@/lib/gateway/poll-service";
import { submitTopazVideoJobForLog } from "@/lib/gateway/topaz-jobs";
import { runGatewayV1KieCreateTask } from "@/lib/gateway/gateway-v1-kie-task-service";
import { submitVolcengineVideoJobForLog } from "@/lib/gateway/volcengine-jobs";
import { VolcengineUpstreamError } from "@/lib/gateway/volcengine-client";
import { buildSubmitFailureFinalizePayload } from "@/lib/gateway/gateway-submit-error-policy";
import { prisma } from "@/lib/prisma";
import {
  extractVendorRequestIdFromText,
} from "@/lib/gateway/vendor-request-id";

export const dynamic = "force-dynamic";

function vendorRequestIdFromSubmitError(e: unknown): string | undefined {
  if (e instanceof VolcengineUpstreamError && e.requestId?.trim()) {
    return e.requestId.trim();
  }
  if (e instanceof Error) {
    return extractVendorRequestIdFromText(e.message) ?? undefined;
  }
  return undefined;
}

function vendorTaskIdFromSubmitError(e: unknown): string | undefined {
  if (e instanceof VolcengineUpstreamError && e.vendorTaskId?.trim()) {
    return e.vendorTaskId.trim();
  }
  return undefined;
}

function asStringOrNumber(v: unknown): string | number | undefined {
  return typeof v === "string" || typeof v === "number" ? v : undefined;
}

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
    topaz?: {
      videoUrl?: string;
      filterModel?: string;
      upscaleFactor?: number | string;
      slowmo?: number | string;
      frameInterpolation?: string;
      resolution?: string;
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

  /** 以 modelKey 为准（非 route）：happyhorse/wan R2V 须走 body.bailian，不能落 DASHSCOPE 空 input 分支 */
  const isBailianR2vModel = isBailianR2vGatewayModel(model);
  const effectiveRoute = isBailianR2vModel
    ? ({ providerKind: "BAILIAN", requestKind: "VIDEO" } as const)
    : route;

  const credentialId =
    route.providerKind === "VOLCENGINE" &&
    route.requestKind === "VIDEO" &&
    !isBailianR2vModel
      ? pickVolcengineCredentialForGatewayJob({
          credentials: auth.credentials,
          modelKey: model,
          clientPage: logMeta.clientPage,
          input: (body.input ?? null) as Record<string, unknown> | null,
        })
      : pickCredentialForKind(
          auth.credentials,
          effectiveRoute.providerKind,
        );
  if (!credentialId) {
    return NextResponse.json(
      {
        error: `No ${effectiveRoute.providerKind} credential bound to this API key`,
      },
      { status: 400 },
    );
  }

  if (route.providerKind === "KIE") {
    if (!body.input) {
      return NextResponse.json(
        { error: "KIE credential and input required for async jobs" },
        { status: 400 },
      );
    }
    try {
      const created = await runGatewayV1KieCreateTask({
        auth,
        body: {
          model,
          input: body.input,
          callBackUrl: body.callBackUrl ?? null,
        },
        logMeta,
      });
      return NextResponse.json({
        code: 200,
        data: {
          taskId: created.taskId,
          logId: created.logId,
          providerKind: "KIE",
        },
      });
    } catch (e) {
      const msg = (e as Error).message || "createTask failed";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  const isBailianR2v = isBailianR2vModel;
  const b = body.bailian ?? {};
  const inputForLog: Record<string, unknown> = isBailianR2v
    ? (() => {
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
        return {
          ...built.input,
          parameters: built.parameters,
          referenceImageUrls,
        };
      })()
    : (body.input ?? {});

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/jobs/createTask",
      providerKind: effectiveRoute.providerKind,
      requestKind: effectiveRoute.requestKind,
      clientSource,
      inputSummary: buildGatewayInputSummary(model, inputForLog),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    if (route.providerKind === "TOPAZ") {
      const tz = body.topaz ?? {};
      const videoUrl = String(
        tz.videoUrl ?? body.input?.video_url ?? body.input?.videoUrl ?? "",
      ).trim();
      if (!videoUrl) {
        return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
      }
      const taskId = await submitTopazVideoJobForLog({
        logId: log.id,
        credentialId,
        model,
        input: {
          videoUrl,
          filterModel:
            typeof tz.filterModel === "string"
              ? tz.filterModel
              : typeof body.input?.filter_model === "string"
                ? body.input.filter_model
                : undefined,
          upscaleFactor:
            asStringOrNumber(tz.upscaleFactor) ??
            asStringOrNumber(body.input?.upscale_factor) ??
            asStringOrNumber(body.input?.upscaleFactor),
          slowmo:
            asStringOrNumber(tz.slowmo) ??
            asStringOrNumber(body.input?.slowmo),
          frameInterpolation:
            typeof tz.frameInterpolation === "string"
              ? tz.frameInterpolation
              : typeof body.input?.frame_interpolation === "string"
                ? body.input.frame_interpolation
                : undefined,
          resolution:
            typeof tz.resolution === "string"
              ? tz.resolution
              : typeof body.input?.resolution === "string"
                ? body.input.resolution
                : undefined,
        },
      });
      return NextResponse.json({
        code: 200,
        data: { taskId, logId: log.id, providerKind: "TOPAZ" },
      });
    }

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

    if (isBailianR2v) {
      const prompt = String(b.prompt ?? body.input?.prompt ?? "").trim();
      const referenceImageUrls = Array.isArray(b.referenceImageUrls)
        ? b.referenceImageUrls.filter(
            (u): u is string => typeof u === "string",
          )
        : [];
      if (!prompt) {
        return NextResponse.json(
          { error: "bailian prompt required" },
          { status: 400 },
        );
      }
      if (referenceImageUrls.length < 1) {
        return NextResponse.json(
          { error: "bailian referenceImageUrls required (1–9)" },
          { status: 400 },
        );
      }
      const resolution = b.resolution === "720P" ? "720P" : "1080P";
      const taskId = await submitBailianR2vJobForLog({
        logId: log.id,
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
      return NextResponse.json({
        code: 200,
        data: { taskId, logId: log.id, providerKind: "BAILIAN" },
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

    return NextResponse.json(
      { error: "Unsupported async job provider" },
      { status: 400 },
    );
  } catch (e) {
    const msg = (e as Error).message || "createTask failed";
    const row = await prisma.gatewayRequestLog.findUnique({
      where: { id: log.id },
      select: { status: true },
    });
    if (row?.status === "RUNNING") {
      const finalizePayload = await buildSubmitFailureFinalizePayload(e, {
        externalTaskId: vendorTaskIdFromSubmitError(e),
      });
      await finalizeRequestLog(log.id, finalizePayload).catch(() => undefined);
    }
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
