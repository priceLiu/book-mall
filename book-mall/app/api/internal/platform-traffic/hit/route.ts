import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { isProbeTrafficPath } from "@/lib/platform-traffic/classify-traffic-path";
import { parsePlatformTrafficAppKey } from "@/lib/site-traffic/app-keys";
import { clientIpFromRequest } from "@/lib/site-traffic/client-ip";
import { authorizeTrafficIngest } from "@/lib/site-traffic/ingest-auth";
import { recordTrafficHit } from "@/lib/site-traffic/record-hit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  appKey: z.string().min(1),
  path: z.string().max(512).optional(),
  userId: z.string().max(64).optional(),
});

export async function POST(request: NextRequest) {
  const auth = authorizeTrafficIngest(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const appKey = parsePlatformTrafficAppKey(parsed.data.appKey);
  if (!appKey) {
    return NextResponse.json({ error: "未知 appKey" }, { status: 400 });
  }

  const ip = clientIpFromRequest(request);
  if (!ip) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    await recordTrafficHit({
      appKey,
      ip,
      userId: parsed.data.userId,
      isProbe: isProbeTrafficPath(parsed.data.path ?? ""),
    });
  } catch (e) {
    console.error("[platform-traffic/hit]", e);
    return NextResponse.json({ error: "写入失败" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
