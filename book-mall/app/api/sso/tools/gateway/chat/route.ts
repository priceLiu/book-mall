import { verifyToolsBearer } from "@/lib/sso-tools-bearer";
import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
} from "@/lib/gateway/book-gateway-link";
import {
  assertPlatformGatewayEntitlement,
  PlatformEntitlementError,
} from "@/lib/platform-gateway-entitlement";
import { clientPageToServiceNavKey } from "@/lib/tool-service-fee/tool-key-nav";
import { toolGwChatStream } from "@/lib/gateway/tool-gateway-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveToolUser(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) return null;
  return auth.userId;
}

export async function POST(request: Request) {
  const userId = await resolveToolUser(request);
  if (!userId) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await assertGatewayApiKeyLinkedForUser(userId);
    const clientPage =
      typeof body.clientPage === "string" ? body.clientPage.trim() : "";
    const nav = clientPage ? clientPageToServiceNavKey(clientPage) : null;
    await assertPlatformGatewayEntitlement(userId, nav ? { navKey: nav } : {});
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return Response.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    if (e instanceof GatewayRequiredError) {
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus },
      );
    }
    throw e;
  }

  const model = typeof body.model === "string" ? body.model.trim() : "";
  const messages = body.messages;
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;
  if (!model) {
    return Response.json({ error: "model required" }, { status: 400 });
  }
  if (!Array.isArray(messages)) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }

  const { model: _m, messages: _msgs, clientPage: _cp, ...params } = body;

  try {
    const streamed = await toolGwChatStream(userId, {
      modelKey: model,
      messages: messages as { role: string; content: unknown }[],
      params,
      clientPage,
    });
    return new Response(streamed.body, {
      status: streamed.status,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Gateway-Log-Id": streamed.logId,
      },
    });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus },
      );
    }
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
