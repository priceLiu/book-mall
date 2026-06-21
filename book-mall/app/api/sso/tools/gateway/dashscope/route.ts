import { NextResponse } from "next/server";
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
import {
  toolGwCreateDashscopeJob,
  toolGwPollDashscope,
} from "@/lib/gateway/tool-gateway-client";

export const dynamic = "force-dynamic";

async function resolveToolUser(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) return null;
  return auth.userId;
}

export async function POST(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) return auth.res;
  const userId = auth.userId;
  const preferredTenantId = auth.preferredTenantId;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    await assertGatewayApiKeyLinkedForUser(userId);
    const clientPageRaw =
      typeof body.clientPage === "string" ? body.clientPage.trim() : "";
    const navFromPage = clientPageRaw ? clientPageToServiceNavKey(clientPageRaw) : null;
    await assertPlatformGatewayEntitlement(userId, navFromPage ? { navKey: navFromPage } : {});
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: e.httpStatus });
    }
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    throw e;
  }

  const kind = String(body.kind ?? "");
  const model = String(body.model ?? "").trim();
  const clientPage =
    typeof body.clientPage === "string" ? body.clientPage.trim() : undefined;
  if (!model) {
    return NextResponse.json({ error: "model required" }, { status: 400 });
  }

  try {
    if (kind === "tryon") {
      const personImageUrl = String(body.personImageUrl ?? "").trim();
      if (!personImageUrl) {
        return NextResponse.json({ error: "personImageUrl required" }, { status: 400 });
      }
      const result = await toolGwCreateDashscopeJob(userId, {
        kind: "tryon",
        model,
        personImageUrl,
        topGarmentUrl:
          typeof body.topGarmentUrl === "string" ? body.topGarmentUrl : undefined,
        bottomGarmentUrl:
          typeof body.bottomGarmentUrl === "string" ? body.bottomGarmentUrl : undefined,
        clientPage,
        preferredTenantId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (kind === "wanx") {
      const prompt = String(body.prompt ?? "").trim();
      if (!prompt) {
        return NextResponse.json({ error: "prompt required" }, { status: 400 });
      }
      const result = await toolGwCreateDashscopeJob(userId, {
        kind: "wanx",
        model,
        prompt,
        negativePrompt:
          typeof body.negativePrompt === "string" ? body.negativePrompt : undefined,
        n: Number(body.n ?? 1),
        clientPage,
        preferredTenantId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    if (kind === "video") {
      const videoBody = body.videoBody;
      if (!videoBody || typeof videoBody !== "object") {
        return NextResponse.json({ error: "videoBody required" }, { status: 400 });
      }
      const result = await toolGwCreateDashscopeJob(userId, {
        kind: "video",
        model,
        body: videoBody as Record<string, unknown>,
        clientPage,
        preferredTenantId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  const userId = await resolveToolUser(request);
  if (!userId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(request.url);
  const taskId = url.searchParams.get("taskId")?.trim();
  const gatewayLogId = url.searchParams.get("gatewayLogId")?.trim() || undefined;
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  try {
    await assertGatewayApiKeyLinkedForUser(userId);
    const output = await toolGwPollDashscope(userId, { taskId, gatewayLogId });
    return NextResponse.json({ ok: true, output });
  } catch (e) {
    if (e instanceof GatewayRequiredError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 403 });
    }
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
