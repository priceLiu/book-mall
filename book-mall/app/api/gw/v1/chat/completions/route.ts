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
  forwardChatCompletionsStream,
  mapGatewayPreCreateLogError,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import {
  GatewayV1ChatError,
  runGatewayV1ChatCompletions,
} from "@/lib/gateway/gateway-v1-chat-service";
import {
  routeGatewayModel,
  UnknownGatewayModelError,
} from "@/lib/gateway/model-router";
import { runGatewayPollWorker } from "@/lib/gateway/poll-service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    await runGatewayPollWorker({ limit: 3 });
  } catch {
    /* opportunistic */
  }

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

  const stream = body.stream === true;

  if (stream) {
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
        endpoint: "/v1/chat/completions",
        clientSource,
        inputSummary: buildGatewayInputSummary(model, restBody),
        ...logMetaToRequestLogFields(logMeta),
      });
    } catch (e) {
      const mapped = mapGatewayPreCreateLogError(e);
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    const result = await forwardChatCompletionsStream({
      credentialId,
      providerKind: route.providerKind,
      body,
    });
    return new NextResponse(result.body, {
      status: result.status,
      headers: {
        "Content-Type": "text/event-stream",
        "x-gateway-log-id": log.id,
      },
    });
  }

  try {
    const result = await runGatewayV1ChatCompletions({ auth, body, logMeta });
    return new NextResponse(result.text, {
      status: result.status,
      headers: {
        "Content-Type": "application/json",
        "x-gateway-log-id": result.logId,
      },
    });
  } catch (e) {
    if (e instanceof GatewayV1ChatError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}
