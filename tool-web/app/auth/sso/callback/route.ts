import { NextResponse, type NextRequest } from "next/server";
import { getMainSiteOrigin, getToolsSitePublicOrigin } from "@/lib/site-origin";

function exchangeSecret(): string | null {
  const s = process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  let redirectPath = request.nextUrl.searchParams.get("redirect")?.trim() || "/fitting-room";
  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    redirectPath = "/fitting-room";
  }

  const base =
    getToolsSitePublicOrigin() ??
    request.nextUrl.origin;
  const origin = getMainSiteOrigin();
  const secret = exchangeSecret();

  if (!code || !origin || !secret) {
    const q = new URLSearchParams();
    if (!code) q.set("reason", "missing_code");
    else if (!origin) q.set("reason", "missing_main_origin");
    else q.set("reason", "missing_exchange_secret");
    return NextResponse.redirect(new URL(`/sso-error?${q}`, base));
  }

  const res = await fetch(`${origin}/api/sso/tools/exchange`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ code }),
  });

  if (!res.ok) {
    const q = new URLSearchParams({ reason: `exchange_${res.status}` });
    return NextResponse.redirect(new URL(`/sso-error?${q}`, base));
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;
  const token = typeof data?.access_token === "string" ? data.access_token : null;
  const expiresIn =
    typeof data?.expires_in === "number" && data.expires_in > 0 ? data.expires_in : 600;

  if (!token) {
    return NextResponse.redirect(
      new URL("/sso-error?reason=no_token", base),
    );
  }

  const redirectUrl = new URL(redirectPath, base);
  const response = NextResponse.redirect(redirectUrl);
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("tools_token", token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: expiresIn,
  });
  return response;
}
