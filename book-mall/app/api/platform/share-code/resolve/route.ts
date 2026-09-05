import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  isShareCodeRateLimited,
  SHARE_CODE_RESOLVE_RATE_LIMIT,
  shareCodeRateLimitKey,
} from "@/lib/share/share-code-rate-limit";
import { resolveShareCode } from "@/lib/share/share-code-service";

export const dynamic = "force-dynamic";

function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  const ip = clientIp(request);
  if (
    isShareCodeRateLimited(
      shareCodeRateLimitKey(ip, "resolve"),
      SHARE_CODE_RESOLVE_RATE_LIMIT,
    )
  ) {
    return NextResponse.json({ error: "请求过于频繁，请稍后再试" }, { status: 429 });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) {
    return NextResponse.json({ error: "缺少 code" }, { status: 400 });
  }

  const resolved = await resolveShareCode(code);
  if (!resolved.ok) {
    return NextResponse.json({ error: resolved.message }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    kind: resolved.kind,
    code: resolved.code,
    title: resolved.title,
    sharerName: resolved.sharerName,
    app: resolved.app ?? null,
  });
}
