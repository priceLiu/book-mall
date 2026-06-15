import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getMainSiteOrigin } from "@/lib/site-origin";

export const dynamic = "force-dynamic";

function readJwtExp(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    let b = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const payload = JSON.parse(Buffer.from(b, "base64").toString("utf8")) as {
      exp?: number;
    };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const token = cookies().get("tools_token")?.value?.trim();
  const origin = getMainSiteOrigin();
  const tokenExpiresAt = token ? readJwtExp(token) : null;
  if (!origin || !token) {
    return NextResponse.json({
      hasCookie: Boolean(token),
      active: false,
      introspect: null,
      tokenExpiresAt,
    });
  }
  const res = await fetch(`${origin}/api/sso/tools/introspect`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const introspect = await res.json().catch(() => null);
  const active = res.ok && Boolean((introspect as { active?: boolean })?.active);
  const out = NextResponse.json({
    hasCookie: true,
    active,
    introspect,
    introspectStatus: res.status,
    tokenExpiresAt,
  });
  if (!active) {
    out.cookies.set("tools_token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
  return out;
}
