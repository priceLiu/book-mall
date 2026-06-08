import { type NextRequest } from "next/server";
import { handleVolcenginePortraitProxy } from "@/lib/gateway/volcengine-portrait-route";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ path: string[] }> };

async function proxy(request: NextRequest, ctx: Ctx) {
  const { path } = await ctx.params;
  return handleVolcenginePortraitProxy(request, "real", path ?? []);
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
