import type { NextRequest } from "next/server";
import { proxyBookMallAuth } from "@/lib/gateway-auth";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  return proxyBookMallAuth(request, "/api/gateway/auth/login-sms");
}
