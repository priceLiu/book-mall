import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import {
  AITRYON_PARSING_MODEL,
  dashscopeImageParsing,
  type DashscopeClothesType,
} from "@/lib/gateway/dashscope-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  createRequestLog,
  finalizeRequestLog,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    imageUrl?: string;
    clothesType?: DashscopeClothesType[];
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const imageUrl = String(body.imageUrl ?? "").trim();
  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl required" }, { status: 400 });
  }

  const credentialId = pickCredentialForKind(auth.credentials, "DASHSCOPE");
  if (!credentialId) {
    return NextResponse.json({ error: "No DASHSCOPE credential" }, { status: 400 });
  }

  const clothesType = body.clothesType?.length
    ? body.clothesType
    : (["upper", "lower"] as DashscopeClothesType[]);
  const model = body.model?.trim() || AITRYON_PARSING_MODEL;
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
      endpoint: "/v1/dashscope/image-parsing",
      providerKind: "DASHSCOPE",
      requestKind: "TRYON",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, {
      imageUrl,
      clothesType,
      imageCount: 1,
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
    const result = await dashscopeImageParsing({
      apiKey: cred.apiKey,
      imageUrl,
      clothesType,
      model,
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
      resultSummary: result.output,
      model,
    });
    return NextResponse.json({
      code: 200,
      data: result.output,
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
