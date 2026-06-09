import { NextResponse } from "next/server";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import type { CanvasModelRole } from "@prisma/client";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

/** 工具 SSO · 统一 Gateway 模型注册表（按 app tag + role 过滤）。 */
export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(req.url);
  const app =
    url.searchParams.get("app")?.trim().toLowerCase() ||
    url.searchParams.get("appTag")?.trim().toLowerCase() ||
    "canvas";
  const appTag =
    app === "e-commerce-toolkit" || app === "ecom-toolkit" ? "ecom" : app;

  const roleParam = url.searchParams.get("role")?.trim().toUpperCase();
  const role: CanvasModelRole | undefined =
    roleParam === "LLM" || roleParam === "IMAGE" || roleParam === "VIDEO"
      ? roleParam
      : undefined;

  const persona = await getUserBillingPersona(auth.userId);
  const link = await getGatewayLinkStatusForUser(auth.userId);
  const boundKinds = link.boundKinds ?? [];

  if (persona === "PLATFORM_CREDIT") {
    const models = await listModelsForApp({
      appTag,
      role,
      persona: "PLATFORM_CREDIT",
      boundKinds,
    });
    return NextResponse.json({ models, platformOffering: true, persona, appTag });
  }

  const models = await listModelsForApp({
    appTag,
    role,
    persona: "BYOK",
    boundKinds,
  });

  return NextResponse.json({
    models,
    platformOffering: false,
    persona: "BYOK",
    appTag,
    boundKinds,
  });
}
