import { NextResponse } from "next/server";

import {
  GatewayRequiredError,
  assertGatewayApiKeyLinkedForUser,
  getGatewayLinkStatusForUser,
} from "@/lib/gateway/book-gateway-link";
import { listPromptOptimizerGatewayModelsFromRegistry } from "@/lib/gateway/prompt-optimizer-chat-models";
import {
  assertPlatformGatewayEntitlement,
  PlatformEntitlementError,
} from "@/lib/platform-gateway-entitlement";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 提示词优化器等工具 · Gateway Chat 模型列表（须已关联 sk-gw） */
export async function GET(request: Request) {
  const auth = verifyToolsBearer(request);
  if (!auth.ok) {
    return Response.json({ error: "未登录" }, { status: 401 });
  }

  try {
    await assertGatewayApiKeyLinkedForUser(auth.userId);
    await assertPlatformGatewayEntitlement(auth.userId, {
      navKey: "prompt-optimizer",
    });
  } catch (e) {
    if (e instanceof PlatformEntitlementError) {
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus },
      );
    }
    if (e instanceof GatewayRequiredError) {
      return Response.json(
        { error: e.message, code: e.code },
        { status: e.httpStatus },
      );
    }
    throw e;
  }

  const link = await getGatewayLinkStatusForUser(auth.userId);
  const persona = await getUserBillingPersona(auth.userId);
  const models = await listPromptOptimizerGatewayModelsFromRegistry({
    boundKinds: link.boundKinds ?? [],
    persona: persona === "PLATFORM_CREDIT" ? "PLATFORM_CREDIT" : "BYOK",
  });

  return Response.json({
    defaultModelKey: models.find((m) => m.modelKey === "deepseek-v4-flash")
      ? "deepseek-v4-flash"
      : models.find((m) => m.credentialBound)?.modelKey ?? null,
    models,
    linked: link.linked,
    boundKinds: link.boundKinds ?? [],
  });
}
