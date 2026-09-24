import { NextResponse, type NextRequest } from "next/server";

import { dashscopeBackgroundGenerationGenerate } from "@/lib/gateway/dashscope-async-image-proxy";
import { WANX_BACKGROUND_GENERATION_MODEL } from "@/lib/ecom/ecom-background-replace";
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
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import { routeGatewayModel } from "@/lib/gateway/model-router";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    input?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body.input && typeof body.input === "object" ? body.input : {};
  const base = typeof input.base_image_url === "string" ? input.base_image_url.trim() : "";
  const refPrompt = typeof input.ref_prompt === "string" ? input.ref_prompt.trim() : "";
  const refImage = typeof input.ref_image_url === "string" ? input.ref_image_url.trim() : "";
  if (!base) {
    return NextResponse.json({ error: "缺少 base_image_url" }, { status: 400 });
  }
  if (!refPrompt && !refImage) {
    return NextResponse.json({ error: "请提供 ref_prompt 或 ref_image_url" }, { status: 400 });
  }

  const model = WANX_BACKGROUND_GENERATION_MODEL;
  routeGatewayModel(model);

  const credentialId = pickCredentialForKind(auth.credentials, "BAILIAN");
  if (!credentialId) {
    return NextResponse.json(
      { error: "No BAILIAN / DashScope credential" },
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
      endpoint: "/v1/bailian/background-generation",
      providerKind: "BAILIAN",
      requestKind: "IMAGE",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, {
        base_image_url: base,
        ref_prompt: refPrompt || undefined,
        ref_image_url: refImage || undefined,
        parameters: body.parameters ?? {},
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
    const result = await dashscopeBackgroundGenerationGenerate({
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
      input,
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
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: {
        imageCount: result.imageUrls.length,
        imageUrls: result.imageUrls.slice(0, 4),
      },
      model,
    });
    return NextResponse.json({
      code: 200,
      data: { imageUrls: result.imageUrls, usage: result.usage },
      logId: log.id,
      providerKind: "BAILIAN",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "background-generation failed";
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: msg,
      model,
    });
    return NextResponse.json({ error: msg, logId: log.id }, { status: 502 });
  }
}
