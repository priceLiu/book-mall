import { NextResponse, type NextRequest } from "next/server";
import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import {
  parseGatewayV1LogMeta,
  logMetaToRequestLogFields,
} from "@/lib/gateway/gateway-v1-log-meta";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardEmbeddings,
  mapGatewayPreCreateLogError,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";

export const dynamic = "force-dynamic";

/** OpenAI 兼容 /v1/embeddings（平台 AI 导览助手 RAG；平台代付）。 */
export async function POST(request: NextRequest) {
  const authOrResp = await requireGatewayV1Auth(request);
  if (isGatewayAuthResponse(authOrResp)) return authOrResp;
  const auth = authOrResp;
  const logMeta = parseGatewayV1LogMeta(request);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const model = typeof body.model === "string" ? body.model : "";
  if (!model) {
    return NextResponse.json({ error: "model required" }, { status: 400 });
  }
  if (body.input == null) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
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
    logMeta.clientSource ?? request.headers.get("x-gateway-client"),
  );
  const { model: _modelField, ...restBody } = body;

  let log;
  try {
    log = await createRequestLog({
      userId: auth.userId,
      apiKeyId: auth.id,
      credentialId,
      model,
      endpoint: "/v1/embeddings",
      clientSource,
      inputSummary: buildGatewayInputSummary(model, restBody),
      ...logMetaToRequestLogFields(logMeta),
    });
  } catch (e) {
    const mapped = mapGatewayPreCreateLogError(e);
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  try {
    const result = await forwardEmbeddings({
      credentialId,
      providerKind: route.providerKind,
      body,
    });
    let usage;
    try {
      usage = parseOpenAiUsage(JSON.parse(result.text));
    } catch {
      usage = undefined;
    }
    await finalizeRequestLog(log.id, {
      status: result.status >= 200 && result.status < 300 ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      usage,
      model,
      failCode: result.status >= 300 ? "UPSTREAM_ERROR" : undefined,
    });
    return new NextResponse(result.text, {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        "x-gateway-log-id": log.id,
      },
    });
  } catch (e) {
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: 0,
      failCode: "UPSTREAM_ERROR",
      failMessage: (e as Error).message,
      model,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
