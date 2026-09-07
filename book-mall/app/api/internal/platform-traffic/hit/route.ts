import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { isProbeTrafficPath } from "@/lib/platform-traffic/classify-traffic-path";
import { parsePlatformTrafficAppKey } from "@/lib/site-traffic/app-keys";
import { clientIpFromRequest } from "@/lib/site-traffic/client-ip";
import { authorizeTrafficIngest } from "@/lib/site-traffic/ingest-auth";
import { recordTrafficHit } from "@/lib/site-traffic/record-hit";

export const dynamic = "force-dynamic";

function isTrafficIngestTransientDbError(e: unknown): boolean {
  if (!e || typeof e !== "object" || !("code" in e)) return false;
  const code = String((e as { code?: string }).code ?? "");
  return code === "P2028" || code === "P2024" || code === "P2034";
}

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

  const hitInput = {
    appKey,
    ip,
    userId: parsed.data.userId,
    isProbe: isProbeTrafficPath(parsed.data.path ?? ""),
  };

  // 统计为 fire-and-forget：立即 204，避免 dev:all 启动高峰阻塞 mall 连接池
  void recordTrafficHit(hitInput).catch((e) => {
    if (isTrafficIngestTransientDbError(e)) {
      console.warn("[platform-traffic/hit] dropped (transient db busy):", e);
      return;
    }
    console.error("[platform-traffic/hit]", e);
  });

  return new NextResponse(null, { status: 204 });
}
