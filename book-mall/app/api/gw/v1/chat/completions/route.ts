import { NextResponse, type NextRequest } from "next/server";
import {
  isGatewayAuthResponse,
  requireGatewayV1Auth,
} from "@/lib/gateway/gateway-v1-route-auth";
import { parseGatewayV1LogMeta } from "@/lib/gateway/gateway-v1-log-meta";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";
import {
  createRequestLog,
  finalizeRequestLog,
  forwardChatCompletions,
  forwardChatCompletionsStream,
  parseOpenAiUsage,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import { buildGatewayInputSummary } from "@/lib/gateway/log-input-summary";
import { buildGatewayChatResultSummary } from "@/lib/gateway/log-result-summary";
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
  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model,
    endpoint: "/v1/chat/completions",
    clientSource,
    clientPage: logMeta.clientPage,
    storyProjectId: logMeta.storyProjectId,
    storyTaskId: logMeta.storyTaskId,
    inputSummary: buildGatewayInputSummary(model, restBody),
  });

  const stream = body.stream === true;

  try {
    if (stream) {
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

    const result = await forwardChatCompletions({
      credentialId,
      providerKind: route.providerKind,
      body,
    });
    let parsed: unknown = null;
    try {
      parsed = result.text ? JSON.parse(result.text) : null;
    } catch {
      parsed = null;
    }
    const usage = parseOpenAiUsage(parsed);
    await finalizeRequestLog(log.id, {
      status: result.status >= 200 && result.status < 300 ? "SUCCEEDED" : "FAILED",
      durationMs: result.durationMs,
      usage,
      resultSummary: buildGatewayChatResultSummary(parsed) ?? undefined,
      failMessage: result.status >= 300 ? result.text.slice(0, 500) : undefined,
      model,
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
      failMessage: (e as Error).message,
      model,
    });
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
