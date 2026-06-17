import { NextResponse, type NextRequest } from "next/server";

import { resolveGatewayBillingPersona } from "@/lib/gateway/gateway-billing-persona";
import {
  marketPlaygroundCreateTask,
  marketPlaygroundPollTask,
} from "@/lib/gateway/market-playground-service";
import { requireGatewaySessionUser } from "@/lib/gateway/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  let body: { canonicalKey?: string; input?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const canonicalKey = body.canonicalKey?.trim();
  if (!canonicalKey) {
    return NextResponse.json({ error: "canonicalKey required" }, { status: 400 });
  }

  const billingPersona = await resolveGatewayBillingPersona(user);

  try {
    const created = await marketPlaygroundCreateTask(user, {
      canonicalKey,
      input: body.input ?? {},
      billingPersona,
    });
    return NextResponse.json(created);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "create failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const user = await requireGatewaySessionUser(request);
  if (!user) return NextResponse.json({ error: "未登录" }, { status: 401 });

  const taskId = request.nextUrl.searchParams.get("taskId")?.trim();
  if (!taskId) {
    return NextResponse.json({ error: "taskId required" }, { status: 400 });
  }

  const logId = request.nextUrl.searchParams.get("logId")?.trim() || undefined;
  const requestKind = request.nextUrl.searchParams.get("requestKind")?.trim() || undefined;

  try {
    const result = await marketPlaygroundPollTask(user, {
      taskId,
      logId,
      requestKind,
    });
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "poll failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
