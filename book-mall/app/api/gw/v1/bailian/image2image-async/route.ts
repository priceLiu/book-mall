import { NextResponse, type NextRequest } from "next/server";

import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta, logMetaToRequestLogFields } from "@/lib/gateway/gateway-v1-log-meta";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { dashscopeImage2ImageGenerate } from "@/lib/gateway/dashscope-async-image-proxy";
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

const ALLOWED = new Set(["wanx-x-painting", "wan2.5-i2i-preview"]);

export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: {
    model?: string;
    input?: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = body.model?.trim() ?? "";
  if (!model || !ALLOWED.has(model)) {
    return NextResponse.json(
      { error: "model must be wanx-x-painting or wan2.5-i2i-preview" },
      { status: 400 },
    );
  }

  const input = body.input && typeof body.input === "object" ? body.input : {};
  if (model === "wanx-x-painting") {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    const base = typeof input.base_image_url === "string" ? input.base_image_url.trim() : "";
    const mask = typeof input.mask_image_url === "string" ? input.mask_image_url.trim() : "";
    if (!prompt || !base || !mask) {
      return NextResponse.json(
        { error: "wanx-x-painting 需要 prompt、base_image_url、mask_image_url" },
        { status: 400 },
      );
    }
  } else {
    const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
    const images = Array.isArray(input.images)
      ? input.images.filter((u) => typeof u === "string" && u.trim())
      : [];
    if (!prompt || images.length === 0) {
      return NextResponse.json(
        { error: "wan2.5-i2i-preview 需要 prompt 与至少一张 images" },
        { status: 400 },
      );
    }
    if (images.length > 3) {
      return NextResponse.json({ error: "images 最多 3 张" }, { status: 400 });
    }
  }

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
      endpoint: "/v1/bailian/image2image-async",
      providerKind: "BAILIAN",
      requestKind: "IMAGE",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, {
        prompt:
          typeof input.prompt === "string" ? input.prompt.slice(0, 200) : undefined,
        imageCount: Array.isArray(input.images) ? input.images.length : 1,
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
    const result = await dashscopeImage2ImageGenerate({
      apiKey: cred.apiKey,
      model,
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
      resultSummary: { imageCount: result.imageUrls.length },
      model,
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
      model,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
