/**
 * Gateway 人像库代理 · 共享处理逻辑
 */

import { NextResponse, type NextRequest } from "next/server";
import { resolveGatewayApiKeyFromBearer } from "@/lib/gateway/api-key-service";
import {
  createRequestLog,
  finalizeRequestLog,
  pickCredentialForKind,
} from "@/lib/gateway/proxy-common";
import {
  volcenginePortraitProxyRequest,
  type VolcenginePortraitLibrary,
} from "@/lib/gateway/volcengine-portrait-client";
import { getDecryptedCredentialApiKey } from "@/lib/gateway/credential-service";
import { parseGatewayClientSource } from "@/lib/gateway/poll-service";

export async function handleVolcenginePortraitProxy(
  request: NextRequest,
  library: VolcenginePortraitLibrary,
  pathSegments: string[],
): Promise<NextResponse> {
  const auth = await resolveGatewayApiKeyFromBearer(
    request.headers.get("authorization"),
  );
  if (!auth) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const credentialId = pickCredentialForKind(auth.credentials, "VOLCENGINE");
  if (!credentialId) {
    return NextResponse.json(
      { error: "No VOLCENGINE credential bound to this API key" },
      { status: 400 },
    );
  }

  const cred = await getDecryptedCredentialApiKey(credentialId);
  if (!cred) {
    return NextResponse.json({ error: "Credential unavailable" }, { status: 503 });
  }

  const method = request.method.toUpperCase();
  const endpoint = `/volcengine/portrait/${library}/${pathSegments.join("/")}`;
  const clientSource = parseGatewayClientSource(
    request.headers.get("x-gateway-client"),
  );

  let body: unknown = undefined;
  if (method !== "GET" && method !== "HEAD") {
    try {
      body = await request.json();
    } catch {
      body = undefined;
    }
  }

  const query: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  const log = await createRequestLog({
    userId: auth.userId,
    apiKeyId: auth.id,
    credentialId,
    model: `portrait:${library}`,
    endpoint,
    providerKind: "VOLCENGINE",
    requestKind: "OTHER",
    clientSource,
    inputSummary: { method, path: pathSegments, queryKeys: Object.keys(query) },
  });

  const started = Date.now();
  try {
    const result = await volcenginePortraitProxyRequest({
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
      library,
      pathSegments,
      method,
      body,
      query,
    });
    const ok = result.status >= 200 && result.status < 300;
    await finalizeRequestLog(log.id, {
      status: ok ? "SUCCEEDED" : "FAILED",
      durationMs: Date.now() - started,
      failMessage: ok ? undefined : result.text.slice(0, 500),
      resultSummary: ok ? { status: result.status } : undefined,
    });
    return NextResponse.json(result.json, { status: result.status });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeRequestLog(log.id, {
      status: "FAILED",
      durationMs: Date.now() - started,
      failMessage: msg.slice(0, 500),
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
