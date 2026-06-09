import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { listPlatformModelsForApp } from "@/lib/platform-model/auto-publish-offerings";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const appKey = request.nextUrl.searchParams.get("app")?.trim() || "ecom";
  const resolvedApp = appKey === "ecom" ? "ecom" : "platform";
  const role = request.nextUrl.searchParams.get("role")?.trim().toUpperCase();

  const models = await listPlatformModelsForApp({
    appKey: resolvedApp,
    role:
      role === "LLM" || role === "IMAGE" || role === "VIDEO"
        ? role
        : undefined,
  });

  return NextResponse.json({ models, platformOffering: true });
}
