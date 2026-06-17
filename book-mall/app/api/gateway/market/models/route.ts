import { NextResponse, type NextRequest } from "next/server";

import { resolveGatewayBillingPersona } from "@/lib/gateway/gateway-billing-persona";
import {
  featuredHeroSlides,
  listMarketModelsForGatewayUser,
  type MarketTaskTag,
} from "@/lib/gateway/market-catalog";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

const TASK_TAGS = new Set<MarketTaskTag>([
  "text-to-image",
  "image-to-image",
  "image-to-video",
  "video-to-video",
  "motion-control",
  "video-upscale",
  "chat",
]);

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const q = request.nextUrl.searchParams.get("q") ?? undefined;
  const provider = request.nextUrl.searchParams.get("provider") ?? undefined;
  const taskRaw = request.nextUrl.searchParams.get("task")?.trim().toLowerCase();
  const task =
    taskRaw && taskRaw !== "all" && TASK_TAGS.has(taskRaw as MarketTaskTag)
      ? (taskRaw as MarketTaskTag)
      : undefined;

  const billingPersona = await resolveGatewayBillingPersona(user);
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") ?? "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(request.nextUrl.searchParams.get("pageSize") ?? "20")),
  );

  const result = await listMarketModelsForGatewayUser({
    gatewayUserId: user.id,
    bookUserId: user.bookUserId,
    billingPersona,
    q,
    provider,
    task,
    page,
    pageSize,
  });

  return NextResponse.json({
    ...result,
    heroSlides: featuredHeroSlides(),
  });
}
