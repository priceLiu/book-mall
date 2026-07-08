import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { dashscopeOutPaintingGenerate } from "@/lib/gateway/dashscope-async-image-proxy";
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

const MODEL = "image-out-painting";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    imageUrl?: string;
    parameters?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = body.imageUrl?.trim() ?? "";
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl 必填" }, { status: 400 });
  }

  routeGatewayModel(MODEL);

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
      model: MODEL,
      endpoint: "/v1/bailian/image-out-painting",
      providerKind: "BAILIAN",
      requestKind: "IMAGE",
      clientSource,
      inputSummary: buildGatewayInputSummary(MODEL, {
        imageUrl: imageUrl.slice(0, 120),
        parameters: body.parameters,
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
    const result = await dashscopeOutPaintingGenerate({
      apiKey: cred.apiKey,
      imageUrl,
      parameters: body.parameters,
    });
    if (!result.ok) {
      await finalizeRequestLog(log.id, {
        status: "FAILED",
        durationMs: Date.now() - started,
        failMessage: result.error,
        model: MODEL,
      });
      return NextResponse.json({ error: result.error, logId: log.id }, { status: 502 });
    }
    await finalizeRequestLog(log.id, {
      status: "SUCCEEDED",
      durationMs: Date.now() - started,
      resultSummary: { imageCount: result.imageUrls.length },
      model: MODEL,
    });
    return NextResponse.json({
      code: 200,
      data: { imageUrls: result.imageUrls, usage: result.usage },
      logId: log.id,
      providerKind: "BAILIAN",
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: (e as Error).message,
      model: MODEL,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
