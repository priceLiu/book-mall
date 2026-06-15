import { NextRequest, NextResponse } from "next/server";

import { appendClearSessionCookieHeaders } from "@/lib/auth/clear-session-cookie-headers";

export const dynamic = "force-dynamic";

/**
 * 静默清除会话 Cookie（302 不回跳），供邀请页等在不清空 URL 的情况下降级旧登录态。
 */
export async function GET(_request: NextRequest) {
  const res = new NextResponse(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
    },
  });
  appendClearSessionCookieHeaders(res.headers);
  return res;
}

export async function POST(_request: NextRequest) {
  return GET(_request);
}
