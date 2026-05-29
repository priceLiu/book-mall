import { NextResponse, type NextRequest } from "next/server";
import {
  gatewaySsoServerSecret,
  getBookMallOrigin,
  getGatewayPublicOrigin,
} from "@/lib/book-mall-base-url";
import { setGatewayToken } from "@/lib/gateway-auth";
import { fetchBookMall } from "@/lib/fetch-book-mall";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim();
  let redirectPath =
    request.nextUrl.searchParams.get("redirect")?.trim() || "/dashboard";
  if (!redirectPath.startsWith("/") || redirectPath.startsWith("//")) {
    redirectPath = "/dashboard";
  }

  const base = getGatewayPublicOrigin() || request.nextUrl.origin;
  const origin = getBookMallOrigin();
  const secret = gatewaySsoServerSecret();

  if (!code || !origin || !secret) {
    const q = new URLSearchParams({ reason: "sso_config" });
    return NextResponse.redirect(new URL(`/login?${q}`, base));
  }

  let res: Response;
  try {
    res = await fetchBookMall(`${origin}/api/sso/gateway/exchange`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
  } catch {
    const q = new URLSearchParams({ reason: "book_mall_unreachable" });
    return NextResponse.redirect(new URL(`/login?${q}`, base));
  }

  if (!res.ok) {
    const q = new URLSearchParams({ reason: `exchange_${res.status}` });
    return NextResponse.redirect(new URL(`/login?${q}`, base));
  }

  const data = (await res.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;

  const token =
    typeof data?.access_token === "string" ? data.access_token : null;
  const expiresIn =
    typeof data?.expires_in === "number" && data.expires_in > 0
      ? data.expires_in
      : 86400;

  if (!token) {
    return NextResponse.redirect(new URL("/login?reason=no_token", base));
  }

  const response = NextResponse.redirect(new URL(redirectPath, base));
  setGatewayToken(response, token, expiresIn);
  return response;
}
