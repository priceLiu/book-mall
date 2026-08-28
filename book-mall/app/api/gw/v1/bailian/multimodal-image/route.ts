import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  createRequestLog,
  finalizeRequestLog,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { finalizeDashscopeSyncWallClockRequestLog } from "@/lib/gateway/log-dashscope-timing-persist";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import {
  DASHSCOPE_MULTIMODAL_IMAGE_GEN_MODELS,
  isDashscopeMultimodalImageGenModel,
  qwenImageEditGenerate,
  type QwenImageEditContentItem,
  type QwenImageEditParams,
  validateDashscopeMultimodalImageContent,
} from "@/lib/gateway/qwen-image-edit-proxy";
import { routeGatewayModel } from "@/lib/gateway/model-router";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ALLOWED = new Set<string>(DASHSCOPE_MULTIMODAL_IMAGE_GEN_MODELS);

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    model?: string;
    content?: QwenImageEditContentItem[];
    parameters?: QwenImageEditParams;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() ?? "";
  if (!model || !ALLOWED.has(model) || !isDashscopeMultimodalImageGenModel(model)) {
    return NextResponse.json(
      {
        error: `model must be one of: ${[...ALLOWED].join(", ")}`,
      },
      { status: 400 },
    );
  }

  const content = Array.isArray(body.content) ? body.content : [];
  const contentErr = validateDashscopeMultimodalImageContent(model, content);
  if (contentErr) {
    return NextResponse.json({ error: contentErr }, { status: 400 });
  }

  routeGatewayModel(model);

  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    return NextResponse.json(
      { error: "No DASHSCOPE credential" },
      { status: 400 },
    );
  }

  const clientSource = parseGatewayClientSource(
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/bailian/multimodal-image",
      providerKind: "DASHSCOPE",
      requestKind: "IMAGE",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, {
        imageCount: content.filter((c) => "image" in c).length,
        prompt: content
          .find((c): c is { text: string } => "text" in c && Boolean(c.text))
          ?.text.slice(0, 200),
      }),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  const started = Date.now();
  try {
    const cred = await getDecryptedCredentialApiKey(credentialId);
    if (!cred) {
      return NextResponse.json({ error: "Credential unavailable" }, { status: 400 });
    }
    const result = await qwenImageEditGenerate({
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl ?? undefined,
      model,
      content,
      parameters: body.parameters,
    });
    if (!result.ok) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.error,
        model,
      });
      return NextResponse.json({ error: result.error, logId: log.id }, { status: 502 });
    }
    await finalizeDashscopeSyncWallClockRequestLog(log.id, {
      vendorCallStartedAtMs: started,
      vendorCallEndedAtMs: Date.now(),
      status: "SUCCEEDED",
      resultSummaryBase: { imageCount: result.imageUrls.length },
      model,
    });
    return NextResponse.json({
      code: 200,
      data: { imageUrls: result.imageUrls, usage: result.usage },
      logId: log.id,
      providerKind: "DASHSCOPE",
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: (e as Error).message,
      model,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
