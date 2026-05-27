import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getBookMallOrigin,
  getGatewayPublicOrigin,
  getGatewaySsoCodeTtlSec,
  requireGatewaySsoServerSecret,
} from "@/lib/gateway/env";
import { syncGatewayUserFromBookUser } from "@/lib/gateway/sync-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "未登录 Book" }, { status: 401 });
  }

  try {
    requireGatewaySsoServerSecret();
  } catch {
    return NextResponse.json({ error: "SSO 未配置" }, { status: 503 });
  }

  const gatewayOrigin = getGatewayPublicOrigin();
  if (!gatewayOrigin) {
    return NextResponse.json({ error: "GATEWAY_PUBLIC_ORIGIN 未配置" }, { status: 503 });
  }

  let redirectPath = "/dashboard";
  try {
    const body = await req.json();
    if (typeof body?.redirect === "string" && body.redirect.startsWith("/")) {
      redirectPath = body.redirect;
    }
  } catch {
    /* default */
  }

  await syncGatewayUserFromBookUser({
    bookUserId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
  });

  const code = randomBytes(24).toString("hex");
  const ttl = getGatewaySsoCodeTtlSec();
  await prisma.ssoAuthorizationCode.create({
    data: {
      code,
      userId: session.user.id,
      expiresAt: new Date(Date.now() + ttl * 1000),
    },
  });

  const q = new URLSearchParams({ code, redirect: redirectPath });
  const redirectUrl = `${gatewayOrigin}/auth/book/callback?${q}`;
  return NextResponse.json({ redirectUrl, codeTtlSeconds: ttl });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const redirect = url.searchParams.get("redirect") ?? "/dashboard";
  const fake = new Request(req.url, {
    method: "POST",
    headers: req.headers,
    body: JSON.stringify({ redirect }),
  });
  const res = await POST(fake);
  if (res.status !== 200) {
    const book = getBookMallOrigin() ?? "http://localhost:3000";
    const cb = encodeURIComponent(`${book}/api/sso/gateway/issue?redirect=${encodeURIComponent(redirect)}`);
    return NextResponse.redirect(`${book}/login?callbackUrl=${cb}`);
  }
  const data = (await res.json()) as { redirectUrl?: string };
  if (!data.redirectUrl) {
    return NextResponse.json({ error: "issue failed" }, { status: 500 });
  }
  return NextResponse.redirect(data.redirectUrl);
}
