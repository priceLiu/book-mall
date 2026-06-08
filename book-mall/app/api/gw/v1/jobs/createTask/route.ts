import { NextResponse, type NextRequest } from "next/server";
import { resolveGatewayApiKeyFromBearer } from "@/lib/gateway/api-key-service";
import {
  createRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import {
  parseGatewayClientSource,
  submitBailianR2vJobForLog,
  submitDashscopeTryOnJobForLog,
  submitDashscopeVideoJobForLog,
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
  const auth = await resolveGatewayApiKeyFromBearer(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

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
      jobKind?: "tryon" | "wanx" | "video";
      personImageUrl?: string;
      topGarmentUrl?: string;
      bottomGarmentUrl?: string;
      prompt?: string;
      negativePrompt?: string;
      n?: number;
      videoBody?: Record<string, unknown>;
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
  const credentialId = pickCredentialForKind(auth.credentials, route.providerKind);
  if (!credentialId) {
    return NextResponse.json(
      { error: `No ${route.providerKind} credential bound to this API key` },
      { status: 400 },
    );
  }

  const clientSource = parseGatewayClientSource(
    request.headers.get("x-gateway-client"),
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

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/jobs/createTask",
    providerKind: route.providerKind,
    requestKind: route.requestKind,
    clientSource,
    inputSummary: buildGatewayInputSummary(model, inputForLog),
  });

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
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
