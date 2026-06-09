import { NextResponse } from "next/server";

import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import { getGatewayLinkStatusForUser } from "@/lib/gateway/book-gateway-link";
import { listModelsForApp } from "@/lib/gateway/model-registry";
import { listPlatformModelsForApp } from "@/lib/platform-model/auto-publish-offerings";
import type { CanvasModelRole } from "@prisma/client";
import { verifyToolsBearer } from "@/lib/sso-tools-bearer";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = verifyToolsBearer(req);
  if (!auth.ok) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const url = new URL(req.url);
  const appKey = url.searchParams.get("app")?.trim() || "tool";
  const appTag =
    appKey === "ecom" || appKey === "e-commerce-toolkit"
      ? "ecom"
      : appKey === "prompt-optimizer"
        ? "prompt-optimizer"
        : appKey === "story"
          ? "story"
          : appKey === "tool"
            ? "tool"
            : "canvas";

  const roleParam = url.searchParams.get("role")?.trim().toUpperCase();
  const role: CanvasModelRole | undefined =
    roleParam === "LLM" || roleParam === "IMAGE" || roleParam === "VIDEO"
      ? roleParam
      : undefined;

  const persona = await getUserBillingPersona(auth.userId);
  if (persona !== "PLATFORM_CREDIT") {
    return NextResponse.json({ models: [], platformOffering: false });
  }

  const registryRows = await listModelsForApp({
    appTag,
    role,
    persona: "PLATFORM_CREDIT",
    boundKinds: [],
  });

  if (registryRows.length > 0) {
    return NextResponse.json({
      models: registryRows.map((r) => ({
        canonicalModelKey: r.canonicalModelKey,
        modelKey: r.modelKey,
        displayName: r.displayName,
        description: r.description,
        role: r.role,
        requestKind: r.requestKind,
        creditsPerUnit: r.creditsPerUnit,
        credentialBound: true,
      })),
      platformOffering: true,
    });
  }

  const models = await listPlatformModelsForApp({ appKey: appTag, role });
  return NextResponse.json({ models, platformOffering: true });
}
